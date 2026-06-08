# Changelog

All notable changes to this package.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.17.4] - 2026-06-08

### Changed

- **`loop-*` artifacts now write to a per-repo folder under your home directory, not the working tree** ([loop-swe.js](.apm/skills/loop-full-swe/loop-swe.js)). The engine previously wrote all run artifacts (`plan.md`, `round-*/`, `runs/<sha>/summary.md`, `reflection.patch`) into `<repo>/.loop-swe/`, which dirtied `git status` and required a manual `.gitignore` entry on every consuming repo. The artifact root is now resolved once by a `resolve-root` leaf to `~/.loop-swe/<repo-key>/` (`<repo-key>` is the repo basename plus a short hash of its absolute path; `%USERPROFILE%` on Windows) and threaded through every phase prompt, so a run never touches the working tree and no `.gitignore` change is needed. The location is **host-neutral** — under `~/.loop-swe/`, not `~/.claude` or `~/.codex`, since the kit targets multiple hosts and run-scratch is not agent config. The absolute path is returned as `artifactRoot` on every gate. `/loop-build`'s pre-flight resolves the same folder with the same deterministic recipe before writing `plan.md`, so the build phase reads the file it wrote; `/loop-retro` resolves the same folder to find a prior build's artifacts. All four SKILL.md files updated to describe the new location.

## [0.17.3] - 2026-06-05

### Fixed

- **`loop-*` resolutions now change code, not just clear the gate** (handoff LT-1). When a `plan` or `build` gate cleared on resume, the digest only *removed* the answered question from `needsHuman` — nothing implemented the operator's decision, so resumed resolutions silently never reached the files (the auto-apply path looped back via `incorporate`, but human-resolved items had no analogous apply path). Both gates now route operator-answered questions into `autoResolved` and fold them into `.loop-swe/plan.md` so a follow-up round implements them: the plan gate adds a `plan-resolve` step before build; the build gate appends them as pending items through the existing `incorporate` path.
- **`e2e-validate` runs the project's format/lint check** (handoff LT-2). Validation discovered the test/build harness but never ran lint, so lint-failing diffs passed as "validated." It now runs the discovered lint/format tool (biome / eslint / prettier / ruff / etc.) on changed files and reports failures as `Code Errors`, with a Windows CRLF-noise caveat (`git ls-files --eol` / staged-content check).

### Changed

- **Operator resolutions are binding in the loop build phase** (handoff LT-3). The implement prompt now states that items flagged as operator decisions are implemented in full; narrowing a directed resolution requires surfacing infeasibility as a new open question, not silently delivering the minimal version.
- **Loop retro artifacts are namespaced per run** (handoff LT-5). `summary.md` / `reflection.md` / `reflection.patch` now write under `.loop-swe/runs/<short-HEAD-sha>/` (the retro agent resolves the sha; the sandboxed script can't) instead of overwriting a single file, so a multi-run effort retains every reflection.

## [0.17.2] - 2026-06-03

### Fixed

- **The four `loop-*` skills are reliably invocable again** — removed `disable-model-invocation: true` from `loop-full-swe`, `loop-research-plan`, `loop-build`, and `loop-retro`. That flag drops a skill's description from the model's context, which (per [anthropics/claude-code#26251](https://github.com/anthropics/claude-code/issues/26251)) makes the model refuse a user-typed `/loop-*` slash command as an unregistered skill because it can't see the skill exists. Dropping the flag restores reliable slash invocation; the heavyweight run stays gated by the `Workflow` tool's own user opt-in. These skills are meant to be user-invoked via `/loop-*` — the flag was the only Claude Code mechanism to mark a skill model-uninvokable, and it is broken, so removing it unavoidably leaves them model-visible too. That visibility is a consequence of the bug, not a goal.
- **The `loop-*` engine can drive gated builds again** — `loop-swe.js` read its control fields (`feature`, `startFrom`, `stopAfter`, `resolutions`) off the `args` global assuming it was an object, but the `Workflow` tool delivers `args` as a JSON string. Every field read `undefined`, so the engine silently ran from `scope` on every call, ignored `startFrom:"build"`, and — because `resolutions` never populated — resume-to-resolve returned a 0-token cache replay of the same gate (a plan with any open question could never reach `build`). The engine now parses `args` when it arrives as a string. Verified end-to-end: fresh args populate correctly, and a resumed run with new `resolutions` re-runs the digest and clears the gate.

## [0.17.1] - 2026-06-02

### Changed

- **`/loop-build` builds from a plan you already have — no `/loop-research-plan` prerequisite** ([.apm/skills/loop-build/SKILL.md](.apm/skills/loop-build/SKILL.md)). The pre-flight now resolves the plan in order — an existing `.loop-swe/plan.md`, a plan file you name, or the plan already in the **conversation** (context-first) — writes it to `.loop-swe/plan.md`, then launches the build. Previously it dead-ended with "run `/loop-research-plan` first" whenever `.loop-swe/plan.md` was absent, which blocked starting a build from a plan worked out in-session. The build-phase review gate (multi-perspective review → adversarial verify → `needsHuman` digest) is unchanged, so building from your own plan keeps the review guarantee. If no plan exists anywhere, it falls back to plan-then-build in one run.
- **`loop-full-swe` is now default-selected in `agent-kit init`** ([lib/init.js](lib/init.js)) — added to the interactive wizard's pre-checked preset list, so a default install includes the loop SWE skill set.
- **`gstack` bundle is no longer installed by default** ([presets/experimenting-engineering.yaml](presets/experimenting-engineering.yaml)) — removed from the `experimenting-engineering` preset's bundle list, so it is not pre-selected on a default init. It remains available as an opt-in bundle (pick it in the bundles step or pass `--bundles gstack`).

## [0.17.0] - 2026-06-02

### Added

- **`loop-full-swe` skill set** ([.apm/skills/loop-full-swe/](.apm/skills/loop-full-swe/)) — an autonomous, architecture-aware SWE loop built on Claude Code's native **dynamic-workflow** runtime, shipped as 4 skills over **one shared engine** ([loop-swe.js](.apm/skills/loop-full-swe/loop-swe.js)):
  - **`/loop-full-swe`** — the uber loop: scope-gate → survey/plan → implement + multi-perspective review → summary/retro in one run. **Autonomous by default** — a self-digest agent classifies every open question into auto-resolved vs needs-human, and the run only pauses (returns a `gate`) when something genuinely needs you. The main agent brokers the gate and resumes via `resumeFromRunId` with the answers; cached phases replay instantly.
  - **`/loop-research-plan`**, **`/loop-build`**, **`/loop-retro`** — the same engine's stages run standalone (`stopAfter` / `startFrom` args).
  - **Leaf-only orchestration** — all fan-out lives in the workflow script (a root); every spawned agent is a leaf that never spawns, respecting Claude Code's `depth=1` subagent constraint ([docs](https://code.claude.com/docs/en/sub-agents)). Findings are schema-validated (no regex parsing), adversarially verified before they cost an implement round, and the loop is budget-scaled and resumable.
  - The shared engine lives once in the uber skill's folder; the three stage skills reference it by sibling path (no duplication). All four are slash-only (`disable-model-invocation: true`). Wired into the new **`loop-full-swe`** preset ([presets/loop-full-swe.yaml](presets/loop-full-swe.yaml)) alongside `to-issues` and the same review/validate dependencies as the build-feature presets.

### Removed

- **`build-feature-dynamic-workflow` skill + preset** — removed in favor of `loop-full-swe`. It predated the verified Workflow API and was built against a guessed, untested `agent()`/`Promise.all`/`.result` shape (its own reference seed was labeled "UNVERIFIED API") and was never dogfooded end-to-end. `loop-full-swe` supersedes it with the real dynamic-workflow runtime, schema-validated handoffs, conditional human gates, and leaf-only orchestration. The durable bash **`build-feature-workflow`** is unaffected.

## [0.16.0] - 2026-06-02

### Added

- **`tdd` skill** ([.apm/skills/tdd/](.apm/skills/tdd/)) — red-green-refactor test-driven development with an explicit anti-pattern guard against "horizontal slicing" (writing all tests then all code) in favor of vertical tracer-bullet slices. Ships with five companion references the SKILL.md links into: `tests.md` (good vs. bad tests), `mocking.md` (mock only at system boundaries), `deep-modules.md`, `interface-design.md`, and `refactoring.md`. Wired into the **`engineering`** preset ([presets/engineering.yaml](presets/engineering.yaml)). Adapted from [mattpocock/skills](https://github.com/mattpocock/skills).
- **`caveman` skill** ([.apm/skills/caveman/](.apm/skills/caveman/)) — ultra-compressed communication mode that drops articles, filler, and pleasantries (~75% fewer tokens) while preserving technical substance, code, and error strings exactly. Persists across turns until "stop caveman"/"normal mode", with an auto-clarity exception for security warnings and destructive-action confirmations. Wired into both the **`engineering`** and **`productivity`** presets ([presets/engineering.yaml](presets/engineering.yaml), [presets/productivity.yaml](presets/productivity.yaml)). Adapted from [mattpocock/skills](https://github.com/mattpocock/skills).

## [0.15.0] - 2026-06-02

### Added

- **`thermo-nuclear-code-quality-review` skill** ([.apm/skills/thermo-nuclear-code-quality-review/](.apm/skills/thermo-nuclear-code-quality-review/)) — an unusually strict, slash-only maintainability review focused on abstraction quality, file-size sprawl (the under-1k → over-1k-lines smell), and spaghetti-condition growth. Pushes the reviewer toward ambitious "code judo" restructurings that delete complexity rather than rearrange it, with an explicit approval bar and presumptive blockers. Wired into the **`engineering`** preset ([presets/engineering.yaml](presets/engineering.yaml)), so existing consumers see it on `agent-kit update`. Adapted from [shaneholloman/cursor-plugins](https://github.com/shaneholloman/cursor-plugins/tree/main/cursor-team-kit/skills/thermo-nuclear-code-quality-review).

## [0.14.0] - 2026-05-29

### Added

- **`desktop-app-loop` skill** ([.apm/skills/desktop-app-loop/](.apm/skills/desktop-app-loop/)) — automate and visually verify an **arbitrary foreign desktop app you did NOT build and did NOT launch in debug mode** (e.g. the OpenAI Codex desktop app). Where `electron-visual-loop` works only because you control the launch, this skill recovers control via a tiered, best-fidelity-first decision flow with explicit fall-through, all OS-agnostic (Windows + macOS) and model-agnostic:
  - **Tier 1 — CDP relaunch**: discover the executable, quit, relaunch with `--remote-debugging-port`, drive via `agent-browser`. Handles **MSIX/Store apps** (which can't take shell flags) by relaunching inside the package container with `Invoke-CommandInDesktopPackage`.
  - **Tier 2 — OS-native accessibility read-back** (no debug port): pywinauto/UIA on Windows, PyObjC/AX on macOS, via the bundled cross-platform helper `helpers/a11y_readback.py` (self-activates the lazy Chromium renderer tree and restores the system screen-reader flag).
  - **Tier 3 — vision computer-use** (universal fallback): bundled executor (`helpers/capture_window.ps1` screenshot + `helpers/input_synth.py` Win32 `SendInput` / macOS `CGEvent`); the grounding model is a pluggable slot (the agent itself, or UI-TARS-desktop). No vendor lock-in.
  - Deps ride **with the skill** (`helpers/requirements.txt`, env-marker pinned) and install idempotently on first Tier-2 use — no preset-level bundle, no deploy-time network.
  - **Validated end-to-end against the Codex desktop app (MSIX, Chromium 148, Windows):** all three tiers confirmed working. One relaunch with `--remote-debugging-port` + `--force-renderer-accessibility` arms Tiers 1 and 2 together; Tier 3 dismissed Codex's onboarding modal via screenshot → click → re-screenshot.
  - Registered in the **`experimenting-engineering`** preset ([presets/experimenting-engineering.yaml](presets/experimenting-engineering.yaml)). Cross-referenced from `electron-visual-loop` and `web-visual-loop`.

## [0.13.1] - 2026-05-22

### Added

- **`superpowers` plugin added to `experimenting-engineering` preset** ([presets/experimenting-engineering.yaml](presets/experimenting-engineering.yaml)) — Claude Code plugin from `anthropics/claude-plugins-official` (TDD, systematic debugging, brainstorming, writing/executing plans, subagent-driven development, rubric-based code review, skill authoring). Lands at user-scope `~/.claude/plugins/`. Plugin file [.apm/plugins/superpowers.plugin.md](.apm/plugins/superpowers.plugin.md) existed since 0.2.0 but wasn't wired into any preset.

## [0.13.0] - 2026-05-22

### Added

- **`experimenting-engineering` preset** ([presets/experimenting-engineering.yaml](presets/experimenting-engineering.yaml)) — extends `engineering`, adds the `gstack` bundle (30+ `/gstack-*` planning/design/QA/ship slash commands via external setup script). Pre-selected in the interactive wizard alongside `engineering`. Lets the stable `engineering` preset stay bundle-free while keeping the experimental external installer one click away.
- **`experimenting-productivity` preset** ([presets/experimenting-productivity.yaml](presets/experimenting-productivity.yaml)) — extends `productivity`, adds the `hyperframes` bundle (HTML-based video composition with TTS, captions, audio-reactive animation). **Opt-in only — not default-selected.** Pick when you actually do video work.

### Changed (breaking for `productivity` preset consumers)

- **`hyperframes` removed from `productivity` preset** ([presets/productivity.yaml](presets/productivity.yaml)) — moved to the new `experimenting-productivity` preset. Existing consumer repos on `productivity` will see `hyperframes` drop out of the preset's bundle list on `agent-kit update`; pick `experimenting-productivity` to get it back. Rationale: stable presets should not auto-install heavy external bundles. The "stable / experimenting" split mirrors what the engineering side now has.
- **Wizard default selection** ([lib/init.js](lib/init.js)) — pre-selects `engineering, experimenting-engineering, productivity, feature-loop`. `experimenting-productivity` is deliberately *not* pre-checked.

## [0.12.0] - 2026-05-22

### Added

- **Six new vendored skills from [mattpocock/skills](https://github.com/mattpocock/skills)** at upstream HEAD `b8be62f`:
  - **`prototype`** ([.apm/skills/prototype/](.apm/skills/prototype/)) — throwaway-code-that-answers-a-question discipline. Routes between a logic branch (interactive terminal app for state/business-logic questions) and a UI branch (radically different UI variations switchable from a floating bottom bar). Three files: [SKILL.md](.apm/skills/prototype/SKILL.md), [LOGIC.md](.apm/skills/prototype/LOGIC.md), [UI.md](.apm/skills/prototype/UI.md). Wired into the `engineering` preset.
  - **`to-prd`** ([.apm/skills/to-prd/](.apm/skills/to-prd/)) — turns the current conversation into a PRD published to the project issue tracker. Pairs with `to-issues`. Wired into the `engineering` preset.
  - **`to-issues`** ([.apm/skills/to-issues/](.apm/skills/to-issues/)) — breaks a plan/spec/PRD into tracer-bullet vertical-slice issues. Wired into the `engineering` preset.
  - **`zoom-out`** ([.apm/skills/zoom-out/](.apm/skills/zoom-out/)) — explicit-invocation skill that asks the agent to step up a layer of abstraction and map the relevant modules + callers using domain vocabulary. Preserves upstream's `disable-model-invocation: true` (slash-command only). Wired into the `engineering` preset.
  - **`write-a-skill`** ([.apm/skills/write-a-skill/](.apm/skills/write-a-skill/)) — meta-skill for authoring new agent skills with progressive disclosure and bundled resources. Wired into the `productivity` preset.
  - **`handoff`** ([.apm/skills/handoff/](.apm/skills/handoff/)) — compact the current conversation into a handoff document for a fresh agent to pick up. Preserves upstream's `argument-hint:` field so Claude Code surfaces it when the user invokes `/handoff <args>`. Wired into the `productivity` preset.

### Changed

- **Upstream sync to `upstream_version: 1.1.0` for all six previously-vendored mattpocock skills**:
  - **`improve-codebase-architecture`** — substantive update. Phase 2 ("Present candidates") now generates a self-contained HTML report (Tailwind + Mermaid via CDN) opened from the OS temp dir, with before/after diagrams and recommendation-strength badges (`Strong` / `Worth exploring` / `Speculative`). New file [HTML-REPORT.md](.apm/skills/improve-codebase-architecture/HTML-REPORT.md) provides the full scaffold + diagram patterns + style guidance.
  - **`grill-with-docs`** — wording-only changes. [SKILL.md](.apm/skills/grill-with-docs/SKILL.md) sharpens the CONTEXT.md framing ("totally devoid of implementation details… a glossary and nothing else"). [CONTEXT-FORMAT.md](.apm/skills/grill-with-docs/CONTEXT-FORMAT.md) drops three example-template sections (`## Relationships`, `## Example dialogue`, `## Flagged ambiguities`) and loosens the definition-length rule from "one sentence" to "one or two sentences". An upstream inconsistency (the `## Rules` block still references the removed sections) is mirrored as-is and documented in [SOURCE.md](.apm/skills/grill-with-docs/SOURCE.md).
  - **`diagnose`** + **`grill-me`** — content unchanged upstream. Metadata-only bump (`upstream_version` + `Last synced` + HEAD pin in [SOURCE.md](.apm/skills/diagnose/SOURCE.md)).

### Notes

- `to-prd` and `to-issues` reference `/setup-matt-pocock-skills` for issue-tracker + triage-label configuration. That setup skill is upstream-specific (configures Matt's conventions) and **not vendored**. Each skill's [SOURCE.md](.apm/skills/to-prd/SOURCE.md) documents the fallback: ask the user which issue tracker (GitHub Issues, Linear, etc.) and what triage label to apply.
- Upstream has no `package.json`, no releases, and no tags. `upstream_version` is a local convention; bumped 1.0.0 → 1.1.0 to mark the substantive content delta + additive `HTML-REPORT.md`.

## [0.11.0] - 2026-05-17

### Added

- **`web-visual-loop` skill** ([.apm/skills/web-visual-loop/](.apm/skills/web-visual-loop/)) — web-stack counterpart to `electron-visual-loop`, using the **same transport** (`agent-browser` CDP). Launches a Chromium instance with `--remote-debugging-port`, connects via `agent-browser`, navigates to a local dev-server URL, snapshots / screenshots / interacts. Covers Vite, Next, SvelteKit, Astro, plain HTML — anything that ships an HTTP dev server. Clean-room implementation (see [SOURCE.md](.apm/skills/web-visual-loop/SOURCE.md) for the rationale against vendoring `webapp-testing`, which would have introduced a separate Python+Playwright transport alongside the existing Node `agent-browser`).
- **`design-critique` skill** ([.apm/skills/design-critique/](.apm/skills/design-critique/)) — vendored from [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) (`design/skills/design-critique/SKILL.md`, commit `a0fda66`, Apache-2.0). Structured design feedback framework across first impression, usability, hierarchy, consistency, accessibility. Used by `feature-loop`'s Phase 5b to critique screenshots produced by the visual-loop skills against the Phase 2 design brief.
- **Both wired into the `feature-loop` preset** by default. The preset now ships the **full** autonomous-loop toolkit out of the box — no remaining "queued for later" gaps for web or design phases.

### Changed (preset scope — breaking from 0.10.0)

- **`feature-loop` preset rescoped** ([presets/feature-loop.yaml](presets/feature-loop.yaml)) to ship a *complete* autonomous-loop kit instead of a stack-agnostic subset:
  - **Removed `my-*` skills** (`my-create-pr`, `my-fix-build`, `my-clean-code`) — personal-prefix skills the user never asked to be wired into this preset. The orchestrator's Phase 3 / Phase 7 descriptions now refer to generic actions (`gh pr create`, build/lint failures) rather than specific kit skills.
  - **Added `electron-visual-loop`, `web-visual-loop`, `design-critique` skills** — carves the feature-loop preset out of the broad "platform-specific stays opt-in" rule. The preset is *about* the workflow that needs visual verification; opt-in here would mean silent degradation.
  - **Added three plugin primitives**, new to the kit, all wired into the preset:
    - [`.apm/plugins/ui-ux-pro-max.plugin.md`](.apm/plugins/ui-ux-pro-max.plugin.md) — [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT). Phase 2 designer.
    - [`.apm/plugins/frontend-design.plugin.md`](.apm/plugins/frontend-design.plugin.md) — Anthropic's `claude-plugins-official` (Apache-2.0). Phase 2 fallback.
    - [`.apm/plugins/code-review.plugin.md`](.apm/plugins/code-review.plugin.md) — Anthropic's `claude-plugins-official` (Apache-2.0). Phase 4 preferred.
- **Saved feedback memory updated** to reflect the carve-out: stack-specific primitives stay opt-in in **broad** workflow presets (`engineering`, `productivity`) but are included in **purpose-scoped** presets like `feature-loop` where the workflow is *about* the primitive.

### Added (infrastructure)

- **`AGENT_KIT_SKIP_PLUGIN_INSTALL=1` escape hatch** ([lib/deploy.js](lib/deploy.js), [lib/verify.js](lib/verify.js)) — mirrors the existing `AGENT_KIT_SKIP_BUNDLE_INSTALL=1`. Records plugin names in state without invoking `claude plugin install`. Used by the `feature-loop` test case to keep the dev environment's Claude Code plugin set untouched during test runs.

## [0.10.1] - 2026-05-17

### Fixed

- **Windows test failures: `update-adopt-defaults` and `update-content-only`** — both tests inlined `$KIT_ROOT` into `node -e "..."` JavaScript string literals to mutate `package.json` and preset YAML. On Git Bash for Windows, `$KIT_ROOT` is the POSIX form `/e/dev/...`; Node interpreted the leading `/` as drive-root, producing bogus paths like `E:\e\dev\GitRepos\my-agent-kits\package.json` (note duplicated `e\`). Extracted the logic into two helper scripts that resolve `KIT_ROOT` via `import.meta.url` — no inlining, no path translation needed:
  - [test/lib/set-kit-version.mjs](test/lib/set-kit-version.mjs) — `node "$KIT_ROOT/test/lib/set-kit-version.mjs" <version>` overwrites `package.json`'s `version` field.
  - [test/lib/add-preset-primitive.mjs](test/lib/add-preset-primitive.mjs) — `node "$KIT_ROOT/test/lib/add-preset-primitive.mjs" <preset> <type> <name>` pushes a primitive onto a preset's list. Path resolves through MSYS argv translation, which works correctly (unlike string-inlined paths).
  - Test suite now passes **13/13 cases, 112/112 asserts** on Windows host directly — up from 11/13. Docker test image (`docker run --rm my-agent-kits-test`) was already 11/11; both environments now match.
- **`assertions.sh` `ok()` / `fail()` exit status** — `ok()` returned the exit status of its final `[ -n "${COUNT_FILE:-}" ] && ...` test, which is `1` (false) when `COUNT_FILE` is unset (i.e. running a test case standalone outside `run-tests.sh`). This made `[ cond ] && ok ... || fail ...` chains run both branches in standalone mode, producing confusing dual pass+fail output. Added explicit `return 0` to `ok()` and `return 1` to `fail()`. No behavior change inside the full runner; standalone debug runs now report correctly.

### Changed

- **`feature-loop` SKILL.md** ([.apm/skills/feature-loop/SKILL.md](.apm/skills/feature-loop/SKILL.md)) — condensed from ~250 lines to 131 by removing tutorial prose and embedded prompt examples. The skill now reads as a tight protocol spec for a reasoning model (Opus): scope rules, constraints, phase order, dependency map, and smoke recipes — no rationale paragraphs, no "compact returns is important" reminders, no `>` quoted prompt templates. Substantive changes (six refinements driven by dogfooding) preserved verbatim:
  - **Plan vs Design scope:** the architectural-constraints section now states "Plan owns mechanism; Design owns aesthetics" and gives a conflict-resolution rule ("design wins on aesthetics, plan wins on architecture; main resolves silently"). Phase 1c's prompt restricts the planner to structural decisions; Phase 2's prompt expands the designer's ownership of all aesthetic choices including specific hex values, sizes, hover/focus visuals, icon glyphs, and motion.
  - **Planner research mandate:** Phase 1c now explicitly cites the `core` instruction's "Research current-state claims" rule. The planner must do live research (WebSearch + WebFetch) for facts that go stale — framework conventions, API behavior, browser quirks, library status — and cite URLs in the plan. Closes a gap where the planner was implicitly trusting training data.
  - **Phase 1a as optional:** Repo exploration is now opt-in. Skip when the repo is familiar or scope ≤5 files; the planner does its own light exploration in that case. Removes wasted sub-agent dispatches on tiny features.
  - **Selective validator step (Phase 4):** validators are spawned **only** when verifying requires reading >20 lines or branching context. For trivially-confirmable findings (5–10 lines), main validates inline. Eliminates wasted sub-agent calls on objectively-true reviewer findings.
  - **Lightweight mode (new section):** for changes touching ≤3 files with no architectural impact, collapse Phases 1a + 1c into a single planner call and Phase 4 fans out to a single combined reviewer instead of 3 parallel workers. Phase 2 still runs if `ui_work=true`.
  - **Phase 6 verification gap is a finding, not a silent skip:** Phase 6 now distinguishes 6a (repo's existing harness) from 6b (no harness exists for this kind of change). 6b mandates a fallback smoke recipe + a surfaced gap-finding for Phase 7. Phase 7 has a new prominent **Loop gaps** section listing every degraded/skipped phase + a **Recommended loop improvements** section turning gaps into actionable next steps.
  - **Smoke test recipes appendix (new):** concrete fallback recipes per stack (static client-side, Node/TS, Vite/Next, Electron, backend API). The agent never has "nothing to run" — there's always at least syntax + structure + load checks.
- **Memory: feedback rule saved** — "Missing verification loop is a finding, not a silent skip." Generalizes beyond feature-loop to any autonomous workflow.

### Notes

- This is a patch release (text-only changes to one skill body + one CHANGELOG + one memory file). No infrastructure, no new primitives, no preset changes. Tests unchanged.
- Source of corrections: real dogfood run on `C:\Users\super\AppData\Local\Temp\feature-loop-dogfood\` exercising the dark-mode-toggle feature against a vanilla HTML/CSS/JS sandbox. The corrections close the friction points that surfaced during that run (planner-designer scope overlap, validator over-eagerness, silent verification skipping).

## [0.10.0] - 2026-05-17

### Added

- **`feature-loop` skill** ([.apm/skills/feature-loop/SKILL.md](.apm/skills/feature-loop/SKILL.md)) — autonomous E2E feature-build orchestrator. The main agent loads this skill when handed a feature request and drives a structured loop: parse → collect & plan → (UI design brief) → implement → code review (parallel workers fanned out from main) → (design critique) → test → summarize. Sub-agents are spawned via the Task tool at depth=1 (Claude Code's hard limit per issues [#4182](https://github.com/anthropics/claude-code/issues/4182) and [#19077](https://github.com/anthropics/claude-code/issues/19077)) — all fan-out happens at the main-agent level. Phases gracefully degrade when optional skills/plugins aren't installed (e.g. design critique skips if no visual-loop is installed). Iteration caps per phase + total loop budget prevent runaway loops.
- **`feature-loop` preset** ([presets/feature-loop.yaml](presets/feature-loop.yaml)) — curated set for the orchestrator: `core` instruction + `feature-loop`, `improve-codebase-architecture`, `my-create-pr`, `my-fix-build`, `diagnose` skills. Stack-agnostic only — Electron-specific (`electron-visual-loop`), web-specific (future `web-visual-loop`), and aesthetic plug-ins (future `design-critique`, `ui-ux-pro-max`) are opt-in via `--primitives '+name'`. Composes with `engineering` via multi-preset syntax: `agent-kit init --preset engineering,feature-loop`.
- **`feature-loop` test case** ([test/cases/feature-loop.sh](test/cases/feature-loop.sh)) — asserts the preset deploys the orchestrator skill + supporting skills, that the orchestrator body documents the depth-1 constraint and phase-skip flags, and that stack-specific opt-ins are correctly absent.

### Notes

- **Why no vendored `review-code` skill:** Anthropic's [code-review plugin](https://github.com/anthropics/claude-code/tree/main/plugins/code-review) was the obvious source to vendor from, but [anthropics/claude-code/LICENSE.md](https://github.com/anthropics/claude-code/blob/main/LICENSE.md) is Anthropic's Commercial Terms of Service — not Apache-2.0/MIT — so verbatim vendoring isn't permissible. Instead, Phase 4 of the orchestrator describes the multi-worker review pattern inline (publicly documented behavior, clean-room implementation) and gracefully invokes Anthropic's `/code-review` plugin if the user has it installed.
- **Sub-agent depth = 1.** Phase 4 spawns 3 review workers in parallel **from the main agent**, not from a wrapping reviewer sub-agent (which would attempt depth=2 and fail). The skill body calls this out as the first architectural constraint.

## [0.9.0] - 2026-05-17

### Added

- **`electron-visual-loop` skill** ([.apm/skills/electron-visual-loop/](.apm/skills/electron-visual-loop/)) — vendored from [fcakyon/claude-codex-settings](https://github.com/fcakyon/claude-codex-settings) (`plugins/agent-browser/skills/electron/SKILL.md`, commit `9ad3323`). Teaches the agent to drive any Electron app over Chrome DevTools Protocol via the [`agent-browser`](https://agent-browser.dev/) CLI: launch with `--remote-debugging-port`, `connect`, `snapshot -i`, `click`, `fill`, `screenshot`, `tab`, multi-session, webview routing, dark-mode preservation. Closes the "coding blind" gap for Electron renderers — the agent can edit code, screenshot the running window, and judge the pixels itself.
- **Opt-in only** — not wired into any preset. Install with `agent-kit init … --primitives '+electron-visual-loop'`. Rationale: most engineering projects aren't Electron; bundling Electron tooling into the default `engineering` preset would be dead weight for the majority of consumers.
- **`electron-visual-loop` test case** ([test/cases/electron-visual-loop.sh](test/cases/electron-visual-loop.sh)) — mirrors `update-adopt-defaults.sh`'s preset-mutation pattern; adds the skill to a transient copy of the `none` preset, inits, asserts the skill folder + `SKILL.md` land at `.claude/skills/electron-visual-loop/` and state captures it.

### Notes

- Runtime dependency: `agent-browser` must be on PATH or invoked via `npx agent-browser`. The kit does not auto-install it; the skill's `allowed-tools` frontmatter whitelists both forms (`Bash(agent-browser:*)`, `Bash(npx agent-browser:*)`).
- The skill is model-invocable (`disable-model-invocation` deliberately unset) so the model routes here when working with Electron apps or when the user asks for a visual feedback loop.

## [0.8.0] - 2026-05-13

### Added

- **`productivity` preset** ([presets/productivity.yaml](presets/productivity.yaml)) — standalone preset containing `core` (instruction), `grill-me` (skill), and `hyperframes` (bundle). Use for repos that want only planning + video tooling without the full engineering skill set.
- **`hyperframes` bundle** ([.apm/bundles/hyperframes.bundle.md](.apm/bundles/hyperframes.bundle.md)) — wraps [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes), an HTML-native video rendering framework for AI agents. Installs `/hyperframes`, `/hyperframes-cli`, `/hyperframes-media`, `/hyperframes-registry`, plus animation runtime skills (`/gsap`, `/animejs`, `/css-animations`, `/lottie`, `/three`, `/waapi`). Requires Node ≥ 22 and FFmpeg on PATH (FFmpeg checked at render time, not install).
- **`installer.kind: npx-skills` bundle flavor** — second installer kind alongside the existing `setup-script` (gstack pattern). Bundles using `npx-skills` declare a single `installer.package` field (e.g. `heygen-com/hyperframes` or `heygen-com/hyperframes@1.2.3`) instead of `source` + `pinned_commit`. The wizard invokes `npx -y skills add <package>` once — the upstream `skills` CLI is host-aware and writes to each detected agent's skills dir itself, so no `host_flag_map` / per-agent loop is needed. State persists the package spec verbatim in `bundle_commits.<name>` for drift detection on `agent-kit update`.
- **Multi-preset selection** — `agent-kit init --preset engineering,productivity` now accepts a comma-separated list. The wizard merges the primitives of every named preset (union, deduped per type) before deploying. Interactive form uses a `multiselect` prompt (must pick at least one). State persists the joined name (`engineering+productivity`) in `.agent-kit.yaml`, and `agent-kit update` round-trips it via `splitPresetNames()`.
- **`hyperframes-bundle` and `multi-preset` test cases** — mirror `gstack-bundle.sh`; assert state captures the `productivity` preset's npx-skills bundle and that multi-preset union/dedupe + state round-trip work end-to-end.

### Removed

- **`microsoft`, `minimal`, `personal` presets** — `microsoft` was an empty alias of `engineering` (v0.1 placeholder); `minimal` overlapped with `none`; `personal` was introduced earlier this release and consolidated into `productivity`. Remaining presets: `engineering`, `productivity`, `none`. Users on the removed presets should re-run `agent-kit init --preset {engineering|productivity|none}` to land on a supported one.

### Changed

- `lib/primitives.js`: bundle metadata reads `installer.kind` from frontmatter (default `setup-script`). Surfaces it as `item.installerKind` for `deploy.js`.
- `lib/deploy.js`: `deployBundle` now dispatches on `installer.kind`. The existing clone-and-run-setup path was refactored into `deploySetupScriptBundle`. New `deployNpxSkillsBundle` runs `npx -y skills add <package>` with a `NPM_CONFIG_REGISTRY` defaulted to the public registry (same fix as 0.7.1 for setup-script bundles).
- `lib/presets.js`: added `loadPresets(names)` for multi-preset merging and `splitPresetNames(field)` for state round-tripping. `loadPreset` now validates the name against `^[A-Za-z0-9][A-Za-z0-9_\-]*$` — `+` is reserved as the multi-preset join character.
- `lib/init.js`: `pickPreset` accepts a comma-separated `--preset` flag and uses `multiselect` interactively. Returns the merged preset directly.
- `lib/update.js`: loads the preset via `loadPresets(splitPresetNames(state.preset))` so multi-preset state files round-trip without breaking the v0.4 migration path.
- `lib/cli.js`: help text shows `--preset NAME[,NAME2]`.
- [docs/maintaining-bundles.md](docs/maintaining-bundles.md): documents the `installer.kind: npx-skills` flavor and when to choose each kind.

### Notes on installer kinds

| Kind | Pin mechanism | Best for |
| --- | --- | --- |
| `setup-script` (default) | 40-char git SHA on a public HTTPS git URL | Stateful installers that need a setup script, native binaries, or per-platform logic (e.g. gstack: bun-driven setup, Playwright Chromium install) |
| `npx-skills` | npm package spec (`pkg` or `pkg@version`) | Skill bundles already packaged for the `skills` CLI; no setup script, no extra runtime install (e.g. hyperframes) |

## [0.7.1] - 2026-05-12

### Fixed

- **Bundle installers now force `NPM_CONFIG_REGISTRY=https://registry.npmjs.org/`** for their subprocess unless the user has explicitly set one. Bundles vendor from public GitHub, so their dependency manifests expect public npm — users on Microsoft codespaces (whose `~/.npmrc` points at `onedrive.pkgs.visualstudio.com/_packaging/odsp-npm` requiring SSO) and other corporate-mirror setups hit 401s on every package fetch inside the installer's `bun install`. Override stays available for legitimate internal mirrors via `NPM_CONFIG_REGISTRY=... ./bin/agent-kit init`.

## [0.7.0] - 2026-05-12

### Added

- **`bundles` primitive type** — wraps external installers as single deployable primitives. Lives at `.apm/bundles/<name>.bundle.md`. Bundles always install to user-global locations (the upstream installers have no `--target` flag) and run once per selected agent via a `host_flag_map`. Frontmatter declares `source`, `pinned_commit`, `installer.command/flags`, `requires`, and `verify_paths`. The kit validates `source` (https git URL only) and `pinned_commit` (hex SHA only) before invoking `git clone`.
- **gstack bundle** ([.apm/bundles/gstack.bundle.md](.apm/bundles/gstack.bundle.md)) — pinned to commit `dc6252d`. Installs all 30+ gstack slash commands as `/gstack-*` prefixed via gstack's `--prefix` flag. Adds planning (`/gstack-office-hours`, `/gstack-autoplan`), build/QA (`/gstack-design-shotgun`, `/gstack-qa`, `/gstack-review`), ship (`/gstack-ship`), security (`/gstack-cso`), browser automation (`/gstack-browse`), and more. Opt-in via the post-scope wizard prompt or `--bundles gstack` in flag mode — no dedicated preset needed.
- **Auto-install of Bun** — gstack's setup requires Bun. The wizard's `pickBundles` step pre-flights and offers to install Bun via the official installer (`curl -fsSL https://bun.sh/install | bash` / Windows MSI). Interactive mode prompts; flag mode auto-installs silently.
- **`--bundles name1,name2` flag** in `agent-kit init` for non-interactive bundle selection. Pass `--bundles ''` to skip all bundles.
- **`bundle_commits:` field in `.agent-kit.yaml`** — records the commit each bundle was last successfully installed at. `agent-kit update` re-runs the installer when the kit's `pinned_commit:` drifts from this record.
- **`AGENT_KIT_SKIP_BUNDLE_INSTALL=1` env var** — skips clone + bun pre-flight + setup, records state as if installed. Used by the Docker test matrix to avoid downloading Chromium per CI run.
- **`gstack-bundle` test case** — verifies preset loads, bundle is recorded in state with the correct pin, engineering primitives still land, no gstack artifacts leak into the consumer repo.
- **[`docs/maintaining-bundles.md`](docs/maintaining-bundles.md)** — maintainer procedure for bumping upstream pins and adding new bundles.

### Changed

- `lib/primitives.js` `TYPE_LOCATIONS`: added `bundles` entry. `listAllPrimitives()` returns a `bundles` array with `source`, `pinnedCommit`, `scope`, `installer`, `requires`, `verifyPaths` parsed from frontmatter.
- `lib/presets.js` `PRIMITIVE_TYPES`: added `bundles`. All 4 existing presets gained `bundles: []`.
- `lib/init.js`: new `pickBundles` step after `pickScope`. Bundles are deliberately excluded from `pickPrimitives` so they appear as a focused yes/no question rather than buried in a long multiselect.
- `lib/deploy.js`: new `deployBundle` branch (step 4b). Pre-flights Bun, clones source at pin, runs installer per agent, persists commit to state. Helpers `bundlesNeedingBunInstall` and `ensureBunInstalledNow` exposed for init's pre-flight prompt.
- `lib/update.js`: type lists now include `bundles`. Commit drift is handled implicitly — `cloneOrUpdateBundleSource` is idempotent, so re-running update with a bumped `pinned_commit:` fetches and reinstalls.
- `lib/verify.js`: checks each bundle's `verify_paths.{agent}` exists and is non-empty. Skipped under `AGENT_KIT_SKIP_BUNDLE_INSTALL=1`.
- `lib/state.js`: persists `bundle_commits: { <name>: <sha>, ... }`.
- `lib/cli.js`: `--bundles` listed in help text.

### Notes on scope

Bundles ALWAYS install globally (`~/.claude/skills/<bundle>/`, `~/.codex/skills/<bundle>/`) regardless of the wizard's `--scope` choice, because the upstream installers don't accept a target directory. The rest of the kit still respects `--scope repo`; only the bundle install bypasses it. This is called out in the interactive prompt and the bundle's frontmatter `scope: global` field.

## [0.3.0] - 2026-05-11

### Breaking changes

- **`prompts` primitive type removed.** Slash-command-like reusable invocations now live as skills with `disable-model-invocation: true` in frontmatter. Aligns with the direction both Anthropic ([commands merged into skills](https://code.claude.com/docs/en/skills)) and OpenAI ([custom prompts deprecated in favor of skills](https://developers.openai.com/codex/custom-prompts)) have published. Authors write SKILL.md once; the kit handles per-vendor translation at deploy time.
- **`code-review` placeholder skill removed.** It was a stub from v0.1 to validate the skills code path; the 6 newly-migrated skills cover that ground.

### Added

- **karpathy instruction primitive** (`.apm/instructions/karpathy.instructions.md`) vendored from [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills) v1.0.0. Always-loaded behavioral guidelines from Karpathy's LLM-coding-pitfalls observations. Matches community usage (most adopt as CLAUDE.md content rather than as a plugin).
- **6 skills migrated from prompts**: `my-commit`, `my-commit-and-push`, `my-create-pr`, `my-explain`, `my-fix-build`, `my-clean-code`. Each authored in Claude format (frontmatter `disable-model-invocation: true`) so they behave as manual-only slash commands without polluting the model's context window.
- **`compileSkillsForCodex` step in `lib/deploy.js`**: when Codex is selected, walks the deployed `.agents/skills/<name>/` folders and emits `agents/openai.yaml` sidecar with `policy.allow_implicit_invocation: false` for every skill that has `disable-model-invocation: true`. One-way translation, kit-author writes Claude format only.
- **`codex-personal-isolation` test case**: verifies Codex-only runs (a) deliver instructions + skills, (b) generate Codex sidecars, (c) don't leak `.claude/` into the repo, (d) don't install Claude Code plugins.

### Changed

- All presets dropped `prompts:` field. `personal.yaml` skills list now contains the 6 migrated slash commands.
- `lib/agents.js`: Claude's `primitiveTypes` is now `["instructions", "skills"]` (was `["instructions", "prompts", "skills"]`); `paths.repo` and `paths.global` removed the `prompts` entry.
- `lib/primitives.js` `TYPE_LOCATIONS`: `prompts` entry deleted; updated comment to reflect v0.3 layout.
- `lib/presets.js` `PRIMITIVE_TYPES`: removed `"prompts"`.
- `lib/init.js`, `lib/update.js`: hardcoded primitive-type loops/skeletons updated to drop `prompts`.
- Test matrix grew from 6/24 to 7/36 — added the codex-personal-isolation case + skills-deployment assertions for both agents.

### Notes

This is a personal kit; semver is informal. Calling this 0.3.0 because dropping a primitive type IS a breaking change for anyone who was relying on `prompts` in their state file or preset config. In practice the only consumer (me) gets clean v0.3 layout via `agent-kit init` in fresh repos.

## [0.2.0] - 2026-05-08

### Added

- **`plugins` primitive type** for Claude Code plugin marketplace integration. Plugins are declared as `.apm/plugins/<name>.plugin.md` with frontmatter pointing at a marketplace + plugin name. Wizard's customize step shows them; deploy step runs `claude plugin marketplace add <source>` + `claude plugin install <name>@<marketplace> --scope user`.
- **superpowers plugin** added to the `personal` preset (from `claude-plugins-official`, the official Anthropic marketplace; auto-updates at Claude Code startup).
- **`agent-kit update` plugin refresh**: tracked plugins are explicitly updated via `claude plugin update <name>@<marketplace>` during `update --content-only` and `update --adopt-preset-defaults`.
- **Verification of plugin install state** in `lib/verify.js` — checks `~/.claude/plugins/installed_plugins.json` for each tracked plugin name.
- **Claude Code CLI in the Docker test image** so the matrix can exercise real `claude plugin install` end-to-end.
- **Plugin assertions** in `claude-repo` and `claude-global` test cases — verify `~/.claude/plugins/installed_plugins.json` references `superpowers`.

### Changed

- All four presets gain a `plugins:` field (default `[]`; only `personal` ships with `[superpowers]`).
- Update test cases now explicitly set the kit to `0.0.1` before init, then bump to `0.2.0` before update — ensures the version-bump-detection logic actually triggers (was silent no-ops once the kit hit `0.2.0` itself).

### Notes on scope

Plugins always install at **user scope** in v0.2 regardless of the wizard's `--scope` choice. Rationale: superpowers is a personal-style preference, and Claude Code's user-scope plugin model is what the rest of the docs assume. Per-repo (project/local) plugin scopes are deferred to a later version.

### Review fixes (incorporated from multi-agent review on v0.2 increment)

- Update flow now mirrors deploy/verify and gates plugin refresh on `state.selected_agents.includes("claude")` — fixes a Codex-only repo invoking `claude plugin update` in a no-op loop.
- State (`.agent-kit.yaml`) only persists plugins that **actually installed successfully**. Failed installs are dropped so a future `agent-kit update` retries them.
- `claude plugin marketplace add` exit status is checked; non-zero skips the subsequent install with a clear error.
- Plugin frontmatter values (`marketplace_source`, `marketplace_name`, `plugin_name`) are validated against a strict regex before reaching `spawnSync` — blocks shell injection from a hostile kit on Windows where `shell:true` is needed for `.cmd` shim discovery.

### Deferred (acknowledged in review, not blocking v0.2)

- Add `plugins` to `claude.supports.primitiveTypes` in `lib/agents.js` so verify can route through the per-agent table (currently a separate branch — works but fragile to refactors).
- Log `kitRef` resolution in deploy.js so a hostile `AGENT_KIT_REF` env var is surfaced.
- Detect non-TTY in deploy.js and document/handle the `claude plugin marketplace add` trust prompt that may block on first use.
- Tighten `verify.js` substring match to a key-aware lookup (currently `json.includes('"name"')`).
- Tests mutate `$KIT_ROOT/package.json` in place — copy to `$WORK` for cleaner isolation.

## [0.1.0] - 2026-05-08

### Added

- Interactive wizard `agent-kit init` (5-step) and `agent-kit update` (3-step), driven by `@clack/prompts`.
- Non-interactive flags for both commands (CI-friendly): `--preset`, `--agents`, `--scope`, `--primitives`, `--codex-personal-layer`, `--yes`, `--content-only`, `--adopt-preset-defaults`, `--dry-run`.
- 4 presets: `personal`, `microsoft` (extends personal; placeholder for v0.1), `minimal`, `none`.
- 2 instruction primitives + 6 prompt primitives migrated from `superliaye/personal-agent-kit`, with `description` / `applyTo` / `added_in: 0.1.0` frontmatter.
- Docker-based test matrix: 6 cases (Claude × {repo, global}, Codex × {repo, global}, two update flows). All green.
- Bootstrap script (`bootstrap.sh`) and PATH-installable launcher (`bin/agent-kit`).
- State tracking via `.agent-kit.yaml` per repo (preset, kit version, agents, scope, primitives snapshot).
- Codex global copy step (`~/.apm/AGENTS.md` → `~/.codex/AGENTS.md`) — APM gap-plug.
- Codex personal layer (`AGENTS.override.md` + `.gitignore`) for repo-scope Codex installs.
- `AGENT_KIT_REF` env var to override the default GitHub install reference (used by tests; can be used for local kit development).

### Changed

- Folded `superliaye/personal-agent-kit` primitives in. That repo will be archived once this is operational.
