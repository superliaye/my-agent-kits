---
description: Autonomous E2E feature-build orchestrator. Use when the user says "add feature X", "implement Y", or any other request that requires planning, coding, reviewing, and verifying changes end-to-end. The main agent drives the loop, delegating each phase to a sub-agent (one level deep, by design) so the main context stays clean enough to judge and drill in. Loop terminates on success criteria, iteration cap, or user abort. Skips UI-specific phases automatically when no UI files are in scope.
allowed-tools: Task, Read, Edit, Write, Glob, Grep, Bash
added_in: 0.10.0
---

# Feature loop

Protocol for autonomous E2E feature build. Main agent drives; each phase delegated to a sub-agent. Main judges every return and decides whether to continue, retry, or drill in.

## Constraints

- **Sub-agent depth = 1 by design.** Fan-out happens at main, not inside a sub-agent — a deliberate choice to keep the main context clean enough to judge, not a platform limit (nested spawning is supported as of Claude Code v2.1.172).
- **Compact returns.** End every sub-agent prompt with a word cap and bullet-only format.
- **Plan owns mechanism; Design owns aesthetics.** On conflict: design wins on aesthetics, plan wins on architecture. Main resolves silently.
- **Missing verification harness is a Phase 7 finding, never a silent skip.**

## Phase 0 — Parse

Extract: goal, success criteria, `ui_work` flag (touches `.tsx/.jsx/.vue/.svelte/.css/.html`/tokens), stack (Electron / web / backend). If success criteria are weak or ambiguous, ask one clarifier, then proceed.

**Lightweight mode** — when ≤3 files in scope, no architectural impact, and main already has them in context:
- Collapse 1a + 1c into a single planner call (planner self-explores).
- Phase 4 fans out to one combined reviewer instead of three.
- Phase 2 still runs if `ui_work=true`.

Declare mode in the parsed-request line so the user can see it.

## Phase 1 — Plan

**1a Explore** — optional. Skip when the repo is familiar to main OR scope ≤5 files. Otherwise spawn an `Explore` sub-agent for: top files to edit, existing patterns, tests in the area. *Survey only — must not propose an approach.*

**1b Visual current-state survey** — only if the user explicitly asked OR `ui_work=true` and the request implies a redesign of an existing surface. Use `electron-visual-loop` / `web-visual-loop`.

**1c Plan** — spawn a `Plan` sub-agent. Scope:
- **STRUCTURE only:** files, mechanism, control flow, *kinds* of elements (button vs switch vs link). Not colors, fonts, sizes, hover/focus visuals, or icon glyphs — those are Phase 2.
- **Research:** apply the `core` instruction's "Research current-state claims" rule. For stale-over-time facts (framework conventions, runtime/browser behavior, library status), do live WebSearch + WebFetch. Cite URLs.
- **If 1a was skipped:** planner does its own light exploration; lists files it read.
- **Output:** numbered steps, risks (≤3), `ui_work` flag, revised success criteria. ≤300 words.

Retry up to 2× if the plan misses obvious risks or contradicts the success criteria.

## Phase 2 — Design brief (skip if `ui_work=false`)

Spawn a designer. Use `ui-ux-pro-max` or `frontend-design` if installed; else fall back to repo's `DESIGN.md` / `CONTEXT.md`, else generic heuristics.

Scope:
- **ALL aesthetics:** hex palette per token, typography + scale, sizes, hover/focus treatments, icon glyphs, motion. May override the plan's aesthetic calls.
- **WCAG AA contrast check** for every fg/muted/accent-on-bg pair; flag failures.
- **No mockup HTML.** ≤300 words.

## Phase 3 — Implement (main)

Main edits per plan + brief. If >15 files or >500 lines, chunk the work and spawn an implementer per chunk; otherwise inline.

## Phase 4 — Code review (parallel from main)

If Anthropic's `/code-review` plugin is installed, invoke it.

Otherwise three parallel `Task` workers:
- **A — bug scan (opus):** runtime bugs only (await, off-by-one, broken refs, type mismatch). High-signal: drop low-confidence flags.
- **B — security/logic (opus):** XSS, auth, correctness errors, race conditions, aria/state desyncs.
- **C — compliance (sonnet):** CLAUDE.md/AGENTS.md rules applicable to changed files. Quote exact rule + violating line.

**Selective validator:** spawn a validator only when verifying needs >20 lines or branching context. Trivially-confirmable findings → main validates inline by reading the cited lines.

Iteration cap: 3. Loop back to Phase 3 with the validated fix list.

## Phase 5 — Design critique (skip if `ui_work=false`)

- **5a Visual verifier:** screenshot the new UI via `electron-visual-loop` / `web-visual-loop`. If neither installed → record as 6b-style gap and continue.
- **5b Design critic:** uses `design-critique` skill if installed, else standard heuristics (hierarchy, alignment, contrast, typography, spacing, accessibility). Issues only, no proposals.

Iteration cap: 2.

## Phase 6 — Verify

**6a Repo harness first.** Discover commands from `package.json`/`Cargo.toml`/`Makefile`/CI/`CLAUDE.md` — don't invent. Run test, build, lint/type-check. Route stubborn failures to `diagnose`. Iteration cap: 3.

**6b No harness for this change kind** — not a skip:
1. Run the closest **Smoke recipe** below for *some* signal.
2. Invoke `electron-visual-loop` / `web-visual-loop` if available.
3. Emit a concrete remediation finding for Phase 7 (e.g. "no test framework — add `tests/X.test.ts` covering [behavior]").

## Phase 7 — Summary (main)

Sections, in order:
- **Changed** — 3–5 bullets (files + intent, no diff dumps).
- **Verified** — Phase 4/5/6 outcomes, one line each.
- **Loop gaps** — *prominent.* Every degraded phase, skipped phase, and iteration-cap stall. Not a footnote.
- **Loop improvements** — actionable remediations: missing-skill installs, missing-test scaffolds, missing-harness suggestions. Restate 6b findings verbatim.
- **Next** — open a PR (the project's PR command, e.g. `gh pr create`), specific smoke-test steps the human should run, or "accept as-is".

Never open PRs autonomously.

## Stop conditions

- **Success:** Phases 4 + 5 + 6 all empty.
- **Cap hit:** any phase exhausts its retry budget. Main writes summary with the unresolved gap.
- **User abort:** partial summary.

## Loop budget

- Total: 10 iterations.
- Per-phase: 4→3, 5→2, 6→3.
- User-tunable per request ("max 5", "single pass").

## Dependency map

| Skill / plugin | Phase | Shipped in `feature-loop` preset |
|---|---|---|
| `improve-codebase-architecture` | 1c | yes |
| `electron-visual-loop` | 1b, 5a (Electron) | yes |
| `web-visual-loop` | 1b, 5a (web) | yes |
| `ui-ux-pro-max` plugin | 2 (preferred) | yes |
| `frontend-design` plugin | 2 (fallback) | yes |
| `code-review` plugin | 4 (preferred — invokes `/code-review`) | yes |
| `design-critique` skill | 5b | yes |
| `diagnose` | 6 | yes |

All dependencies ship with the preset. Any later removal → degraded mode + 6b/7 finding.

## Smoke recipes (6b fallbacks)

- **Static HTML/CSS/JS:** `node --check` on JS; parse HTML, regex-assert critical IDs / aria attrs / script tags.
- **Node/TS, no tests:** `node --check`, `npx tsc --noEmit`, smoke-`require` the entry.
- **Vite / Next / SPA, no tests:** `npm run build`; boot dev server, `curl -fsS /` for 5xx; `web-visual-loop` if installed.
- **Electron, no tests:** build; `electron-visual-loop` screenshot + element-existence check.
- **Backend API, no tests:** `curl -fsS` representative inputs; DB migrations dry-run.
- **None of the above fit:** the 6b gap-finding is the minimum delivery.
