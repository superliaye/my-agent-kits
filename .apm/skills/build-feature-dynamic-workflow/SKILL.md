---
description: Single-run, full-parity counterpart to /build-feature-workflow built on Claude Code's native dynamic-workflow runtime instead of a bash orchestrator. The same architecture-aware feature-build phases (plan → review → design → implement → validate → code-review → triage → design-critique → docs → summary → reflection) run as one in-session dynamic workflow that orchestrates subagents, with no mid-run pauses — open questions are collected into a decisions report at the end. Use when the user says "/build-feature-dynamic-workflow <text>", or wants to run the build-feature loop on the native dynamic-workflow runtime (e.g. to compare against /build-feature-workflow). For the durable, resumable, human-in-the-loop bash version use /build-feature-workflow.
allowed-tools: Read, Write, Glob, Grep, Bash
added_in: 0.14.0
---

# /build-feature-dynamic-workflow

The architecture-aware feature-build loop of [`/build-feature-workflow`](../build-feature-workflow/SKILL.md),
re-expressed on top of Claude Code's native **dynamic-workflow** runtime
(research preview, Claude Code v2.1.154+). Same phases, different engine.

| | `/build-feature-workflow` | `/build-feature-dynamic-workflow` (this skill) |
|---|---|---|
| Engine | `orchestrator.sh` dispatching `claude -p` subprocesses | Native dynamic-workflow runtime orchestrating subagents |
| Plan substrate | Tagged work-item queue on disk (`.build-feature-workflow/state.md`) | A JS workflow script; intermediate results in script variables |
| Persistence | Resumable across sessions / reboots | Single session; resumable only within the session |
| Human gates | Pauses on `ASK`/`HUMAN`/`DECISION`, resumes via re-invocation | **No mid-run pause** — open questions collected into a decisions report at the end |
| Self-improvement | Phase 11 reflection patch | Phase 11 reflection patch (same) |

Both produce the same artifact shapes and run the same dependency skills.
Run them on the same feature to compare the two engines.

## Important: the scripting API is undocumented

As of 2026-05-29 the dynamic-workflow JavaScript scripting API (the
`agent()` / phase / parallelism primitives, the `.claude/workflows/*.js`
file structure) is **not published** in official docs
([workflows docs](https://code.claude.com/docs/en/workflows)). Anthropic's
supported authoring path is: *you describe the task, Claude writes the
script, you save it from a run.* This skill is built around that path.

## How to invoke

```
/build-feature-dynamic-workflow build a dark-mode toggle in settings
```

The skill drives two usage modes:

### Mode A — generate and run (primary, reliable)

When invoked, the assistant:

1. Confirms the working tree has no uncommitted changes the build would
   overwrite (the workflow's agents will edit code and write artifacts
   under `.build-feature-dynamic-workflow/`).
2. Reads [`workflow-spec.md`](workflow-spec.md) — the authoritative
   phase graph this workflow must implement.
3. Launches a **dynamic workflow** for the user's feature that
   implements that spec. Because the prompt the assistant constructs
   contains the word *workflow* and a full orchestration spec, the
   runtime writes the JS script and executes it in the background.
4. Surfaces the run: tells the user to watch via `/workflows`, and on
   completion relays the summary + the **Open decisions report**.

This regenerates a correct script against the live runtime every time,
so it never depends on guessed API names.

### Mode B — run a saved workflow

Once a Mode-A run does what you want, save its script as a command:
`/workflows` → select the run → press `s` → save as
`build-feature-dynamic-workflow` (project `.claude/workflows/` or personal
`~/.claude/workflows/`). Thereafter run it directly as a `/command`.

[`reference/build-feature-dynamic-workflow.js`](reference/build-feature-dynamic-workflow.js)
is a **best-effort seed** for this file. Its API names are unverified —
treat it as a structural template to diff against the script the runtime
actually generates, not as a known-good script.

## Single-run adaptations (vs the bash version)

The native runtime cannot pause mid-run for human input and does not
persist across sessions. The spec adapts the bash loop accordingly — see
[`workflow-spec.md`](workflow-spec.md) for the full mapping. The three
load-bearing changes:

1. **Escalations become best-effort + a decisions report.** Where the
   bash version emits `ASK`/`HUMAN`/`DECISION` and pauses, here the
   phase agent first applies the escalation discipline (check
   `~/.claude/CLAUDE.md`, `<repo>/CLAUDE.md`, `CONTEXT.md`, `docs/adr/`,
   `docs/`, and prior phase artifacts), and if the answer is genuinely
   absent it appends the question — with a `checked against: …; not
   found` audit line and the **assumption it proceeded with** — to
   `.build-feature-dynamic-workflow/decisions.md`, then continues.
   Nothing blocks. Phase 10 surfaces this file as the Open decisions
   report for you to resolve after the run.

2. **Bounded loops replace cybernetic self-bail.** The Phase 4↔5
   implement/validate retry and the Phase 7-driven fix loop are capped
   (3 rounds, matching the bash outer cap). An agent that detects a
   repeated failure mode stops early and records it as an open decision.

3. **State lives in the script, artifacts on disk.** The workflow
   script holds phase results in variables and passes artifact paths
   forward. Agents (not the script) read/write the filesystem, writing
   all artifacts under `.build-feature-dynamic-workflow/` so a run can
   sit beside a `/build-feature-workflow` run without clobbering it.

## Disciplines (unchanged from /build-feature-workflow)

These carry over verbatim into every phase agent's prompt; the spec
restates them. See [`/build-feature-workflow` SKILL.md](../build-feature-workflow/SKILL.md)
for the canonical wording.

- **Research delegation:** SMALL research (one source) inline with a
  cited URL; SIZABLE research (multi-source synthesis) delegated to a
  dedicated research subagent that emits a research artifact only.
- **Escalation discipline:** never record an open decision for anything
  the documentation above already answers.
- **No-narrative input (Phase 7 triage, Phase 8 design critique):**
  triagers and critics reason from review findings + Phase 1 artifacts +
  project docs, never from implementer chain-of-thought.

## Dependencies

Shipped via [`presets/build-feature-dynamic-workflow.yaml`](../../../presets/build-feature-dynamic-workflow.yaml).
Same set as `/build-feature-workflow` — the phase agents invoke the same
skills via the `Skill` tool:

- Skills: `e2e-validate`, `improve-codebase-architecture`,
  `improve-DDD-architecture`, `design-critique`, `diagnose`,
  `electron-visual-loop`, `web-visual-loop`.
- Plugins: `ui-ux-pro-max`, `frontend-design`.

Subagents spawned by a dynamic workflow inherit the session's tool
allowlist and run in `acceptEdits` mode. Add the shell commands, web
fetches, and MCP tools the phase agents need to your allowlist before a
long run so it does not stall on a mid-run permission prompt.

## Files

```
.apm/skills/build-feature-dynamic-workflow/
├── SKILL.md            ← this file
├── workflow-spec.md    ← authoritative phase graph the workflow implements
└── reference/
    └── build-feature-dynamic-workflow.js  ← UNVERIFIED-API seed for a saved workflow
```

## Status

First testable cut. Mode A (generate-and-run from the spec) is the
reliable path; the reference `.js` is an unverified seed pending the live
runtime's generated script. Not yet dogfooded end-to-end against the
dynamic-workflow runtime — that is the natural next validation step, and
the point of running it head-to-head with `/build-feature-workflow`.
