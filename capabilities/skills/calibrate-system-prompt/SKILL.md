---
name: calibrate-system-prompt
description: |
  Calibrate an AI agent's system prompt and tool/function descriptions in any repo and for
  any model provider. Reads the full prompt plus every tool definition, makes surgical edits
  that SHRINK net token count without weakening behavior, then spawns parallel reviewers to
  confirm nothing breaks and the size actually dropped.

  Use when: "calibrate the system prompt", "this tool/function description is too verbose",
  "trim the agent prompt", "the agent keeps misusing tool X", "tune the prompt instructions",
  "reduce prompt tokens".

  Not for: adding new capabilities to a prompt, writing new skills, or debugging a live
  production incident.
added_in: 0.30.0
---

# Calibrate System Prompt

You are a **prompt engineer** calibrating the instructions and tool/function descriptions a
production AI agent receives. Every token in the system prompt and tool descriptions costs
real money on **every request, for every user**. Your mandate: make the descriptions smaller,
sharper, and more accurate — never bigger.

This skill is provider- and repo-agnostic. The prompt under calibration may target Anthropic,
OpenAI, Copilot, Gemini, or a local model; it may live in a Markdown/Jinja template or inside
a source string. **Discover the artifacts — never assume a path. Discover the repo's own
tooling — never invent commands.**

## The Prime Directive

**The NET byte count across system prompt + tool descriptions must decrease.** If it grew, the
calibration failed. Byte count is a deterministic within-file proxy for size — fewer bytes ≈
fewer tokens within one tokenizer. (For Unicode-heavy prompts, e.g. CJK, confirm the win with a
token counter if your harness has one.)

A tool description MAY grow if the growth adds critical missing information the agent lacks
(e.g. it doesn't know a tool does semantic vs. lexical search) — but only if the system prompt
shrinks by MORE than the tool grows. The net across all edited files must be negative.

## Arguments

Parse the target and flags from the invocation arguments (`$ARGUMENTS` in Claude Code; the
text following the command otherwise). If invoked with no explicit argument — a model
auto-trigger or description match — infer `TARGET` from the request and confirm it with the
user before Phase 0.

| Argument | Default | Description |
|----------|---------|-------------|
| `TARGET` | (required) | Tool/function name or prompt section to calibrate (e.g. `SearchM365`, `Retrieval Strategy`, or `all`) |
| `--paths "a,b"` | (discovered) | Explicit artifact paths — skip Phase 0 discovery |
| `--telemetry` | off | Pull production usage/error signals to inform edit aggressiveness (Phase 2) |
| `--dry-run` | off | Run Phases 0–3, output the edit plan, write nothing |

---

## Phase 0: Locate the artifacts

The repo-agnostic core. If `--paths` is given, use it. Otherwise discover, then **confirm the
candidate set with the user before editing** — cheap insurance against editing the wrong file
in an unfamiliar repo.

Search for both artifact kinds with **your harness's file-search tool** (Grep/ripgrep, or
whatever search your harness provides). The same concept wears different clothes per provider:

| Artifact | Where it hides (any of these shapes) |
|----------|--------------------------------------|
| **System prompt** | A template/embedded file: `*system*prompt*`, `*prompt*.{md,txt,j2,jinja,hbs,yaml,yml}`, `instructions.*`, `persona.*`, a `//go:embed` / `include_str!` target. Or an in-code string: Anthropic `system=`; OpenAI `{"role": "system", ...}`; SDK `instructions=`; LangChain `SystemMessage` / `ChatPromptTemplate` / `from_messages`; a Go/Rust `const` string literal. |
| **Tool / function descriptions** | A registry/definitions file: `registry.*`, `tools.*`, `tool_definitions.*`, or a `*.yaml`/`*.json` tool catalog. Or inline: JSON-schema `"description"` fields; Anthropic `tools=[{name, description, input_schema}]`; OpenAI `tools=[{type:"function", function:{description, parameters}}]`; MCP `@tool(...)` / `Tool(description=...)`; a Go struct `Description:` field; framework `@tool` decorator docstrings. |

The POSIX example below shows the search *intent* — run the equivalent with whatever search tool
and shell your harness has (it need not be `grep`/bash). Cover every language the repo actually
uses; add file types as needed.

```bash
rg -li "system.?prompt|\"role\": ?\"system\"|\bsystem\s*=|instructions\s*=|SystemMessage|ChatPromptTemplate|from_messages" \
  -g "*.{py,ts,js,go,rs,md,j2,txt,yaml,yml}"
rg -l "description\s*[:=]|input_schema|\"function\"|parameters|@tool|Tool\(" \
  -g "*.{py,ts,js,go,rs,json,yaml,yml}"
```

In a **monorepo, or any repo with fixtures**, scope the search to the target agent's package and
exclude noise (`-g '!**/{test,tests,fixtures,examples,evals,__snapshots__}/**'`) so example
prompts and golden files don't pollute the candidate set.

If the live prompt is **fetched from a DB, remote config, or a prompt-management service**, the
source holds only a fallback/default string — which may not be what production serves. Do not
calibrate it until you confirm with the user which string is actually served at runtime.

Read **gating/config** that decides which tools are exposed (feature flags, allow/deny lists)
for context only — do not edit it. Then **measure the baseline** — the byte size of each artifact
file (`wc -c` on a POSIX shell; `(Get-Content -Raw <file>).Length` in PowerShell; or any byte
readout your harness gives). Record `BYTES_BEFORE` per file and the total.

## Phase 1: Inventory & analysis

Read every located source **in full** — the prompt, all tool definitions, and the **handler /
implementation** for `TARGET` *if it lives in this repo* (so you know what the tool actually
does, not what it claims). If `TARGET` is a remote MCP tool or a pure declarative schema with no
readable handler here, skip the accuracy check and calibrate for redundancy/shrink only. Then
produce:

1. **Description accuracy** (when an in-repo handler exists) — does the description match the implementation? What's missing or wrong?
2. **Redundancy map** — what does the prompt say that a tool description also says? What do multiple tool descriptions each repeat?
3. **Dependent artifacts** — what else references `TARGET` and relies on specific wording? Skills, sub-prompts, docs, tests, evals:
   ```bash
   rg -l "TARGET" -g "*.{md,py,ts,js,go,rs,yaml,yml,json}"   # or your harness's search tool
   ```
   These MUST keep working after your edits.
4. **Prompt bloat** — which `TARGET`-related sections are unnecessarily verbose?

## Phase 2: Telemetry (optional — only if `--telemetry`)

If the repo exposes production observability for this agent (logs, traces, eval runs,
analytics — whatever it has), pull two signals for `TARGET`: call **volume** and **error /
failure rate**. The numbers set edit aggressiveness:

| Signal | Edit posture |
|--------|--------------|
| High volume, low error | Working well — remove only true redundancy |
| Low volume | Rarely used — aggressive trimming acceptable |
| High volume, high error | Description may mislead — prioritize accuracy over shrinkage |
| Absent from logs | May be feature-gated — verify it's live before editing |

If no telemetry source exists, note it and proceed. Telemetry is informative, not blocking.

## Phase 3: Draft surgical edits

Produce a precise edit plan. Do NOT apply yet.

**Cutting rules** (priority order):

1. **Remove restatements of the parameter schema.** If the schema already documents a param, cut it from the prose description.
2. **Collapse cross-tool redundancy.** If two descriptions both say "never construct IDs — use prior search results," keep it on the more general tool, cut from the specific one.
3. **De-duplicate prompt vs. tool description.** The prompt holds the short general principle; the tool description holds the specifics. Not both.
4. **Cut hedge language.** "You should consider using" → imperative or delete. "In most cases" → delete.
5. **Cut examples that don't disambiguate.** An example earns its bytes only if removing it would cause a plausibly wrong choice.
6. **Compress verbose constraints.** "You must not under any circumstances construct IDs manually" → "Never construct IDs manually."
7. **Strip transport/namespace prefixes from tool names in prose.** `mcp__outlook__SendEmail` / `outlook.SendEmail` → `SendEmail` for readability. **But** keep the fully-qualified form anywhere the agent resolves a tool by exact string (explicit load/select hints, routing tables), and keep it when two sources expose the same bare name (collision) — there, bare is ambiguous.

**Never cut:**
- **Negative constraints** ("do NOT construct IDs", "never call X before Y") — they prevent real production mistakes.
- **Sole references** — the only place a behavior is documented.
- **Wording a dependent artifact relies on** — if a skill/test/router cites a phrase, it must survive.
- **Provider/template control structures** — Jinja `{% if %}` blocks, feature-gated sections, partials. Not redundancy.
- **Tool names and parameter schemas** — API surface. Description text only; never rename a tool or change a property/type/required array.

**Per-edit output:**

```
### Edit N: <path>:<lines> — <what changes>
BEFORE (X bytes): <exact original>
AFTER  (Y bytes, −Z): <replacement>
Rationale: <one sentence — the redundancy/waste removed>
Risk: Low | Medium — <what could break, or "no dependent artifact relies on this">
```

**Running tally + gate.** Sum system-prompt before→after and tool-descriptions before→after;
the **net must be negative**. If it isn't, discard your lowest-value edits until it is. A
net-zero or net-positive change to the system prompt is not allowed. If **no** surviving edit
set can reach net-negative — e.g. the only worthwhile change is a necessary tool-description
growth with no compensating prompt cut — apply nothing: report that the Prime Directive can't
be met for this TARGET and stop.

**Present the full edit plan and STOP for user approval.** (If `--dry-run`, stop here.)

## Phase 4: Parallel critical review

After approval, spawn **two reviewers in parallel** (the Agent tool with
`subagent_type=general-purpose` in Claude Code; in Codex, instruct the harness to spawn two
parallel agents). If your harness has no sub-agent mechanism, run both reviewer prompts
yourself, sequentially — parallelism is an optimization, not a requirement. Paste the complete
Phase 3 edit plan and the discovered paths into each.

**Reviewer 1 — Breakage Auditor.** "Your only job: find edits that break existing behavior.
Read the pre-edit system prompt and every dependent artifact found in Phase 1. For each edit:
(a) does any skill/test/router/doc cite this text by name or paraphrase? (b) does any negative
constraint get weakened or removed? (c) is there a real scenario where removing this text makes
the agent pick the wrong tool? Output per edit: SAFE | RISK: <what breaks, where>. End with a
verdict count."

**Reviewer 2 — Shrink Maximizer.** "Your only job: find shrink the editor missed. For each
AFTER text: can it be cut further without losing meaning? Does it still overlap other parts of
the prompt? Then scan beyond the plan for paragraphs that restate obvious LLM behavior, examples
that illustrate the obvious, and sections duplicating what the tool schema already says. Output:
per-edit OPTIMAL | CUT MORE: <shorter version>, then additional cuts with estimated bytes saved."

**Consolidate:** apply SAFE edits as-is; revert any RISK edit a reviewer ties to a real
dependency (keep it and note the call if the risk is only theoretical); fold in Shrink Maximizer
cuts that the Breakage Auditor didn't flag.

## Phase 5: Apply, verify, sweep

(Skip if `--dry-run`.)

1. **Apply** the reviewed edits with the Edit tool — precise, targeted replacements.
2. **Verify the Prime Directive:** re-measure every edited file's byte size (same method as the
   Phase 0 baseline). If the total did not decrease, you failed — find the inflating edit, revert
   it, re-measure. Do not proceed until confirmed smaller.
3. **Sweep dependent artifacts:** search `TARGET` across skills/tests/docs (`rg "TARGET"`, or
   your harness's search); verify every tool name still exists unchanged in the definitions.
4. **Run the repo's own checks** if you edited source files — discover them (`package.json`
   scripts, `Makefile`, CI config, the linter/type-checker the repo already uses). Don't invent
   commands; if there's no check tool, skip.
5. **Output the summary:** TARGET; files modified; size impact (before→after, −N bytes, −P%)
   for prompt and tool descriptions and the net; edits applied; edits reverted (with reason);
   reviewer findings; sweep result; telemetry note.

---

## Guardrails

- **Never add new capabilities.** Missing content is a separate task — open an issue.
- **Never change tool names or parameter schemas.** Description text only.
- **Never modify handler/implementation behavior, feature-gating, or config.** Read-only.
- **Commit nothing.** This skill produces file edits; the user reviews and commits.

## Error handling

| Condition | Action |
|-----------|--------|
| TARGET not found in any source | Report sources searched, list the tools you did find, stop |
| No system prompt discoverable | Report the discovery heuristics tried; ask the user for the path |
| Telemetry source unavailable | Log and skip — proceed with static analysis |
| Size gate fails (prompt grew) | Revert the offending edit, re-measure, report which edit inflated it |
| No edit set can reach net-negative | Report the Prime Directive can't be met for this TARGET; apply nothing |
| Reviewer flags a blocking regression | Report it; ask the user whether to revert or accept the risk |
| Repo check tool fails after edit | Likely a string-formatting slip — fix and re-run |
