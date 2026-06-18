# Changelog

All notable changes to this package.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.36.0] - 2026-06-17

### Added

- **`/my-aggressive-clean-up`** (new, [capabilities/skills/@my/my-aggressive-clean-up/](capabilities/skills/@my/my-aggressive-clean-up/)) — a tool-agnostic cleanup skill that captures the aggressive-cleanup philosophy: after a feature flag, killswitch, experiment flight, or any conditional code path collapses to one surviving branch, it removes the orphaned state, types, variables, imports, styles, comments, dead tests, and the repo-wide footprint (duplicate flag checks, now-constant arguments, consumer-side dead reads, the flag's own declaration) the removed branch left behind. Headlines the wrong-branch hazard — which side survives depends on the flag's polarity and terminal value — and builds to zero errors/warnings before stopping for review. Ships in the **engineering** preset.

## [0.35.0] - 2026-06-17

Consolidates the build/plan flow onto a single **`loop`** preset and stops shipping the Anthropic `code-review` and `superpowers` plugins by default. The `feature-loop` preset and its orchestrator skill are retired — `loop` already covered everything they did except the older single-agent orchestrator — and the experimental engineering add-on drops back to opt-in.

### Removed

- **The `feature-loop` preset and the `/feature-loop` skill** — retired in favour of the `loop` toolset (`/loop-build` over two nested agents, with `/loop-plan-manual` / `/loop-plan-semiauto` authoring its plan + acceptance). `loop` already shipped every supporting skill `feature-loop` carried (architecture, diagnose, the web/electron visual loops, design-critique); only the older single-agent orchestrator is dropped. The preset's deploy test (`test/cases/feature-loop.sh`) is removed.
- **The `code-review` plugin pointer** (`capabilities/plugins/code-review.plugin.md`) — listed only by the `feature-loop` preset, so retiring that preset leaves it unreferenced. Anthropic's `/code-review` plugin is no longer installed by default; in-loop multi-lens review is covered by `/loop-review-committee`.

### Changed

- **`DEFAULT_SELECTED_PRESETS` is now `engineering, productivity, loop`** ([lib/init.js](lib/init.js)). `feature-loop` is removed (retired) and `experimenting-engineering` is demoted to opt-in, so the **superpowers** plugin is no longer default-installed — select `experimenting-engineering` to get it.
- **`experimenting-engineering` slimmed to its unique add-ons.** It now ships only `calibrate-system-prompt` + the `superpowers` plugin; the `desktop-app-loop` and `loop-review-committee` skills and the three `@reviews` agents (`architecture-review`, `rules-enforcer`, `general-review`) it used to carry are consolidated into the `loop` preset, which already listed them. The agent deploy/roundtrip tests now exercise the `loop` preset.

## [0.34.0] - 2026-06-16

Hard-deletes the dead `loop-swe.js` engine family and all `@wf` workflow skills. The `/loop-build` + `/loop-plan-*` flow supersedes them, so the old engine and its stages carried only dead weight. The `loop-full-swe` preset — the only one shipping the new flow — is repurposed (renamed to `loop`), not removed.

### Removed

- **The loop-swe engine family** — the `loop-full-swe`, `loop-research-plan`, `loop-swe-build`, and `loop-retro` skills and the shared `loop-swe.js` dynamic-workflow engine they ran. The everyday flow is now `/loop-build` (acceptance-gated build over two nested agents) with `/loop-plan-manual` / `/loop-plan-semiauto` authoring its plan + acceptance artifacts.
- **All `@wf` skills** — `wf-research` and `wf-semiauto-grill`, plus the `wf-feedback-protocol` snippet they shared. Codebase-first research and the semiauto grill now live in the loop-plan family (`research-fan-out` snippet, `/grill-with-committee`).
- **The `loop-full-swe` preset is renamed to `loop`** (survivor-only): it ships `loop-build`, the loop-plan family, the grill/review/readiness leaves, and the architecture/DDD/visual supporting skills — the four dead skills are dropped. `DEFAULT_SELECTED_PRESETS` and the deploy tests track the rename. The deleted `@wf` skills are also dropped from the `experimenting-engineering` preset.

## [0.33.0] - 2026-06-16

Adds the **loop-plan** family — a plan/PRD + acceptance authoring flow that runs *before* `/loop-build`, so the build step consumes ready artifacts instead of drafting them from session context. Renames the review-agent namespace and generalises the three reviewers to review or answer *anything*, not just code.

### Added

- **`/loop-plan-manual`** (new, [capabilities/skills/@loop/loop-plan-manual/](capabilities/skills/@loop/loop-plan-manual/)) — a human-in-the-loop planner. The resident drives four phases: a parallel **research fan-out** (codebase + web sub-agents, `deep-research` for time-sensitive facts) → **`/grill-with-docs`** (every question to the human) → **draft** `plan.md` + `acceptance.md` in `/loop-build`'s exact two-block acceptance format under `~/.loop-plan/<repo-key>/` (overridable; host-neutral, never dirties git) → **artifact review** by the three lens agents (resident judges + revises, ~2 rounds, surfaces dismissals). It then **stops and points at `/loop-build`** (Mode A) — no auto-handoff.
- **`/loop-plan-semiauto`** (new, [capabilities/skills/@loop/loop-plan-semiauto/](capabilities/skills/@loop/loop-plan-semiauto/)) — the minimal-human planner ("if lucky, no human"). Identical pipeline to `-manual`, except the grill is **`/grill-with-committee`**: the three lenses vote on each batched question, a unanimous enumerated answer is accepted silently, and only a split or an `"Other"` vote escalates to the user.
- **`/grill-with-committee`** (new, [capabilities/skills/@loop/grill-with-committee/](capabilities/skills/@loop/grill-with-committee/)) — a reusable semiauto grill built on `/grill-with-docs`. Per round: select a batch of **mutually-independent** questions, frame each with **2–4 options + "Other"**, spawn the three lens agents to vote per `committee-answer-contract`, then apply the consensus rule (all three same enumerated option → accept silently; any split or any `"Other"` → escalate). Standalone it writes a `grill.md` digest with per-decision provenance (`committee` | `human`). Usable on its own or embedded as the `-semiauto` grill phase.
- **Three shared-phase snippets** — `research-fan-out`, `draft-to-loop-build-format`, `artifact-review` — inlined by **both** plan skills via `<!-- include: -->`, so the only real difference between `-manual` and `-semiauto` is the grill phase.
- **`committee-answer-contract` snippet** — the grill-committee vote contract (`{ choice, rationale, evidence, proposed? }`), sibling of `review-finding-contract`. Consensus is mechanical: string-equality on `choice` with no `"other"` present.

### Changed

- **`@code-reviewers` → `@reviews`.** The three review agents moved to `capabilities/agents/@reviews/` for a namespace that reads right: they now review/answer about *anything*, not only code. Their `name:` fields (`architecture-review`, `rules-enforcer`, `general-review`) and `added_in` are unchanged, so every `subagent_type` reference, preset entry, and manifest `agentDef` stays wired. Live references to the old folder path were rewired; historical records (this changelog, dated specs) are left as-is.
- **The three review agents are generalised to lens + task.** Each `AGENT.md` now fixes a **lens** (architecture = structure/design, rules-enforcer = rules/constraints, general-review = first-principles) and supports two **tasks** set by the spawn prompt: **(a) review an artifact** → findings per `review-finding-contract`, and **(b) answer a grilled question** → a vote per `committee-answer-contract`. For code artifacts the lenses behave exactly as before (`architecture-review` still runs `/improve-codebase-architecture` + `/improve-DDD-architecture`); for a plan/PRD or a grill question the lens generalises. One set of agents now serves both the grill committee and artifact review.

Ships the loop-plan skills (`loop-plan-manual`, `loop-plan-semiauto`, `grill-with-committee`, plus `grill-with-docs` for the manual grill) and the renamed/generalised `@reviews` agents in the **`loop-full-swe`** preset.

## [0.32.0] - 2026-06-15

Rebuilds the day-to-day build flow as a new **`/loop-build`** skill over two nested agents, and **renames the old `/loop-build`** (the loop-swe engine segment) to **`/loop-swe-build`**, marking it deprecated.

### Added

- **`/loop-build`** (new, [capabilities/skills/@loop/loop-build/](capabilities/skills/@loop/loop-build/)) — a resident-facing entry for the everyday "build from an agreed plan" flow. The resident confirms readiness (Mode A: a prior plan/QA session already produced the artifacts → build with no questions; Mode B: invoked cold → draft plan + acceptance from context and confirm only genuine gaps), then spawns the build agent and relays a structured summary. The plan + acceptance criteria travel **in the build agent's spawn prompt** — no enforced artifact path. This is **not** a segment of `loop-swe.js`.
- **`loop-build-agent`** ([capabilities/agents/@loop/loop-build-agent/](capabilities/agents/@loop/loop-build-agent/)) — implements the plan, then runs the loop with a **hard acceptance gate before any code review** ("don't review code on an experience that isn't built right"): implement → spawn `loop-build-acceptance` → iterate to a full pass, bounded to a round cap → only then run `/loop-review-committee` (non-interactive, with concrete invocation instructions) → judge findings directly and incorporate → return. Bounded-loop-then-escalate on non-convergence. Carries the `Agent` tool so it can spawn its own children (Claude Code v2.1.172+ nested sub-agents). Named `loop-build-agent` to stay distinct from the `loop-build` skill.
- **`loop-build-acceptance` agent** ([capabilities/agents/@loop/loop-build-acceptance/](capabilities/agents/@loop/loop-build-acceptance/)) — verifies a build against one acceptance doc with two criteria blocks: runs functional checks (incl. `e2e-validate`) for **non-visual** criteria, and routes **visual** criteria to the right feedback-loop by UI env (`web-visual-loop` / `electron-visual-loop` / `desktop-app-loop`). Verify-only (no `Edit`/`Agent`); returns a per-criterion pass/fail split with evidence. No silent pass — a criterion with no runnable signal is reported `no-harness`, not a pass.
- **`.githooks/pre-commit`** — a hermetic pre-commit hook (no npm, no network) that blocks a commit whose `package.json` version is out of sync with `package-lock.json`'s version fields, wired via `core.hooksPath` (set by the npm `prepare` script). Closes the gap that let a version bump ship with a stale lockfile (`npm ci` checks the dependency tree, not the root version — npm/cli#7000). Runs locally at commit time — no agent/token cost.

### Changed

- **`/loop-build` (old) renamed to `/loop-swe-build` and deprecated.** It remains the implement+review *segment of the `loop-swe.js` engine* (still driven by `/loop-full-swe`, `/loop-research-plan`, `/loop-retro`); only its name moved. Every inbound reference was repointed to the renamed skill — the `loop-full-swe` SKILL/EXECUTION/FLOW/`loop-swe.js`, `loop-research-plan`, `loop-retro`, `presets/loop-full-swe.yaml`, and `test/cases/loop-full-swe-preset.sh`. The new `/loop-build` does **not** inherit those references.
- **`/loop-review-committee` defaults to the local change set.** With no fixed point named it no longer asks — it reviews the uncommitted working tree (else this branch vs its base), so an orchestrating agent (the build agent) can drive it non-interactively and consume the grouped findings.
- **Corrected the stale `depth=1` claim across the loop docs.** Nested sub-agent spawning is supported as of Claude Code v2.1.172; the `loop-swe.js` engine and `feature-loop` keep their leaf-only/single-level topology **by design** (determinism, resumability, clean main context), not because the runtime forbids nesting. Updated `loop-full-swe` SKILL/EXECUTION/`loop-swe.js`, both loop presets, and `feature-loop`. Historical CHANGELOG entries are left as-is.

Ships the new skill + two agents and all loop-related capabilities (the committee + reviewer agents + feedback/e2e deps) in the **`loop-full-swe`** preset.

## [0.31.0] - 2026-06-15

Adds a new **`agents`** capability type — deployable subagent definitions authored once and emitted to both Claude Code (`~/.claude/agents/<name>.md`) and Codex (`~/.codex/agents/<name>.toml`) — and ships a code-review committee built on it.

### Added

- **`agents` capability type.** A fourth folder-based capability (`capabilities/agents/<name>/AGENT.md`, with the same `@`-grouping support as skills). Each agent is authored once in Claude subagent format (frontmatter + system-prompt body); deploy emits the Claude `.md` verbatim (snippet includes expanded) and **translates** it to a Codex custom-agent `.toml` (`name` / `description` / `developer_instructions`). Threaded through the scanner, presets, wizard pickers, manifest, and init/update orphan reconciliation parallel to `skills`.
- **Three code-review agents** under `capabilities/agents/@code-reviewers/` — `architecture-review` (module-depth + DDD/hexagonal, leveraging `/improve-codebase-architecture` and `/improve-DDD-architecture`), `rules-enforcer` (the repo's own written rules), and `general-review` (correctness & robustness). Each returns findings in the loop's shared `FINDINGS` shape.
- **`loop-review-committee`** skill — spawns the three review agents in parallel on the current diff and presents their findings grouped by reviewer (the axes stay separate). Deliberately concise: the agents carry the criteria.
- **`review-finding-contract` snippet** — the shared finding contract, inlined into the review agents at deploy via `<!-- include: -->`.

### Changed

- **Snippet inliner generalized.** `expandSkillIncludes` (SKILL.md-only) became `expandIncludes` + `expandFolderIncludes`. A deployed skill folder now has `<!-- include: NAME -->` markers expanded in **every shipped `.md`** — strict for `SKILL.md` (an unknown marker fails the deploy), lenient for other bundled `.md` (unknown markers left verbatim so docs can show the syntax). Each agent's `AGENT.md` is expanded strictly.

Ships the agents + committee skill in `experimenting-engineering`.

## [0.30.0] - 2026-06-15

Adds `calibrate-system-prompt`, a provider- and repo-agnostic skill for trimming an AI agent's system prompt and tool/function descriptions, to the `experimenting-engineering` preset.

### Added

- **`calibrate-system-prompt`** ([capabilities/skills/calibrate-system-prompt/](capabilities/skills/calibrate-system-prompt/)) — generalized from a project-specific `calibrate-system` skill into a portable one. It reads a target agent's full system prompt plus every tool/function definition, drafts surgical edits that **shrink net byte count** without weakening behavior, spawns two parallel reviewers (a Breakage Auditor and a Shrink Maximizer), then applies, re-measures against the size gate, and sweeps dependent artifacts. The generalization replaces hardcoded paths with a discovery phase (heuristics for both template files and in-code prompt strings across Anthropic / OpenAI / Copilot / Gemini / MCP shapes), makes production telemetry an opt-in `--telemetry` step instead of a mandatory Kusto pull, and verifies via the repo's own discovered lint/type-check rather than fixed tools. Ships in `experimenting-engineering`.

## [0.29.0] - 2026-06-15

Skill grouping folders may now nest to any depth, and the `@loop` family is reorganized to use it. This is a source-layout change only — deploy still flattens every skill to `<skillsRoot>/<name>/`, so the installed result and how Claude/Codex consume the skills are unchanged.

### Added

- **Nested skill grouping folders.** A `capabilities/skills/` directory with no `SKILL.md` of its own is a grouping folder; the scanner ([lib/capabilities.js](lib/capabilities.js)) now descends through such folders recursively instead of exactly one level, so skills may sit under multiple nested namespaces (e.g. `@loop/@feedback-loops/<name>/`). By convention group folders at every level take an `@` prefix (cosmetic; detection is structural). The walk stops at the first `SKILL.md`, so a skill's own internal subdirs (`helpers/`, `recipes/`, `_unshipped/`) are never mistaken for nested skills. Leaf folder names must stay globally unique, since deploy flattens every skill to `<skillsRoot>/<name>/`.

### Changed

- **`@loop` reorganized into sub-namespaces.** `loop-check-readiness` moved to `@loop/@setup/`; the three visual/desktop feedback-loop skills (`desktop-app-loop`, `electron-visual-loop`, `web-visual-loop`) moved to `@loop/@feedback-loops/`. The SWE-engine skills (`feature-loop`, `loop-build`, `loop-full-swe`, `loop-research-plan`, `loop-retro`) stay at `@loop/` root. Skill names, presets, and deployed paths are unchanged.

## [0.28.0] - 2026-06-14

Adds the `@wf` skill family and its first skill, `wf-research`, to the `experimenting-engineering` preset.

### Added

- **`wf-research`** ([capabilities/skills/@wf/wf-research/](capabilities/skills/@wf/wf-research/)) — a codebase-first research primitive that runs as a file-based dynamic Workflow. Given a feature request or a bug it maps the problem area (relevant code at `file:line`, how it works today, constraints, open questions) into a "raw research brief" with **no proposed directions**, to ground a downstream grill or plan. It does light web search inline and escalates to moderate/deep web research (reusing `/deep-research`) only for time-sensitive facts. Agents hand off only through write-once disk artifacts, each validated by a checker before the next step reads it. Ships in `experimenting-engineering`.

## [0.27.0] - 2026-06-12

Durable install manifest. `init` establishes the selection (from the wizard defaults) and records it in `~/.agent-kit/manifest.json`; `update` is now where an existing install changes. This fixes the long-standing bug where `update` silently reverted a customized install back to the default presets (it resolved its working set from `DEFAULT_SELECTED_PRESETS`, never from what was actually installed), and it wires up the previously-orphaned bundle-pin skip so an unchanged bundle no longer re-runs its expensive installer on every `update`.

### Added

- **`~/.agent-kit/manifest.json`** ([lib/manifest.js](lib/manifest.js)) — the durable, agent-neutral (Claude + Codex) record of what agent-kit owns: selected skills, instructions, plugins, and bundles (with their installed pin). Lives in `HOME`, not under the disposable bundle cache root. It is the source of truth `update` replays and the ownership ledger that bounds what agent-kit may auto-remove.
- **Two-mode `update`.** `agent-kit update` is an interactive adjust — the wizard pre-checks your current manifest selection ([lib/pickers.js](lib/pickers.js)) so you only toggle the on/off delta; unticking a capability removes it. `agent-kit update --current` is the non-interactive replay: re-apply the current selection at the new kit version. With no TTY (piped / CI) `update` falls back to replay so it never hangs on a prompt.
- **Deletion reconciliation.** `init` removes the deployed dir of any skill dropped from the prior manifest's selection (re-running `init` resets to defaults); `update` removes any skill its final selection no longer deploys — an interactive untick or a capability the current kit no longer ships (the "removed-after-X" semantic, no `deleted_in` frontmatter needed). External installers (bundles, plugins) are never blind-deleted — they get an informed-manual hint.
- **Bundle pin-skip.** A bundle whose manifest pin already matches the kit pin skips its installer entirely instead of re-cloning and re-running setup on every `update`; a stale pin (maintainer bump) re-runs it.
- **Plugins are install-if-absent.** A plugin already present in `installed_plugins.json` is left untouched (Claude Code auto-updates plugins at startup), and `update` no longer forces a `claude plugin update`. Previously every `deploy()` re-ran `claude plugin marketplace add` + `claude plugin install` for each selected plugin, so an unchanged `update` reinstalled all plugins (e.g. `ui-ux-pro-max`, `superpowers`) over the network. Now an unchanged `update` only re-copies skills (cheap) and skips present plugins and pin-matched bundles.

### Changed (breaking)

- **`agent-kit update` no longer accepts selection flags** (`--preset` / `--agents` / `--capabilities`). Selection changes happen interactively or are replayed with `--current`. With no manifest it refuses with an actionable error — existing users must run `agent-kit init` once to establish the manifest.
- **Ownership rule.** In the manifest → agent-kit may manage it. On disk but absent from the manifest → user-installed, left untouched.

## [0.26.0] - 2026-06-12

Re-sync of the `@matt-pocock` vendored skills against upstream HEAD `694fa30` (2026-06-10). Content-only; no new files vendored, no `added_in` changes (these are re-syncs, not new capabilities). The other seven 1.1.0-era matt-pocock skills were unchanged upstream and left untouched.

### Changed

- **`to-prd`** — step 2 of the PRD process reworked from a "deep modules" framing to a "test seams" framing ("prefer existing seams, use the highest seam possible"). `upstream_version` → `2026-06-10 (694fa30)`.
- **`grill-with-docs`** — `CONTEXT-FORMAT.md` Rules block cleaned up: dropped the three bullets that referenced sections upstream had already removed (`Flag conflicts explicitly`, `Show relationships`, `Write an example dialogue`). This resolves the "Known upstream inconsistency (1.1.0)" previously recorded in its `SOURCE.md`, which is now removed. `upstream_version` → `2026-06-10 (694fa30)`.
- **`teach`** — `SKILL.md` refreshed: adds a "Fluency vs Storage Strength" subsection, splits Knowledge/Skills guidance (difficulty as enemy vs. tool), and adds mutable-mission handling and primary-source/anchor-link requirements per lesson. Local frontmatter mods preserved (no `name`, `disable-model-invocation` left unset, kit description). `upstream_version` `2026-06-08 (2bf7005)` → `2026-06-10 (694fa30)`.

## [0.25.0] - 2026-06-12

De-APM and vocabulary cleanup. The kit never invoked APM — `.apm/` was only a directory name and `deploy.js` copied files directly — but the naming and dead config implied otherwise. This release renames the core concept to **capability**, removes every APM vestige, and drops the last repo-scoped artifacts.

### Changed (breaking)

- **"primitive" → "capability"** everywhere the term means a deployable kit artifact. The preset key `primitives:` is now `capabilities:`, the CLI flag `--primitives` is now `--capabilities`, `lib/primitives.js` is now `lib/capabilities.js`, and the `onboard-primitive` maintainer skill is now `onboard-capability`. Domain uses of "primitive" inside skill content (DDD "primitive obsession", "testing primitives") are unchanged.
- **`.apm/` directory renamed to `capabilities/`.** It holds the capability sources (`capabilities/skills/`, `capabilities/instructions/`, …) that `deploy.js` copies directly to your global agent directories. The name was the single biggest source of "is this APM-managed?" confusion.
- **`agent-kit init`/`update` no longer accept a positional TARGET directory.** Deploy has been global-only since 0.22.0, so the argument did nothing. Re-run with flags only.

### Removed

- Every APM reference: the dead `apm_dependencies` preset field and `apmTarget` agent field (declared but never read), the `apm.yml`/`apm_modules/` ignore rules, the `"my-agent-kits": "file:"` self-dependency, and APM-framed comments/docs/test assertions.
- The stale tracked `.agent-kit.yaml` repo-scope state file (referenced removed concepts: `scope: repo`, `claude_md_merge`, `codex_personal_layer`).
- The dogfood copies of consumer skills under `.claude/skills/` (kept only the hand-written `onboard-capability` maintainer skill).
- The two dated APM-era installer design docs under `docs/superpowers/` and the README "Design history" section that linked them.

## [0.24.0] - 2026-06-11

Loop-SWE engine retro follow-ups: cut the over-decomposition cost driver and close the artifact-hygiene near-misses surfaced by the global-only refactor's own retrospective.

### Changed

- **`tooLargeForOneRun` now keys on genuine independence, not file count** ([.apm/skills/loop-full-swe/loop-swe.js](.apm/skills/loop-full-swe/loop-swe.js) scope prompt). The bounded-round build can touch many files in one run, so a coherent rename/refactor/cleanup spanning many files is no longer decomposed; the engine splits only when the request is several genuinely independent features. Fixes the root cause of the refactor that ran as 8 separate loop runs (~10.7M tokens) when one run would have done.
- **Review weight matches the track.** A `trivial` change now runs a single **merged** reviewer covering the architecture + DDD + general-correctness lenses in one pass (still adversarially verified), instead of the 3-agent panel. `standard`/`architectural` tracks keep the full separate-reviewer panel; UI work keeps the design lens on every track. The 3-reviewer + per-finding-verify fan-out was the dominant per-run cost and added little when correctness is mechanically checkable by the `e2e-validate` that already runs.
- **`distribute-to-issues` is surfaced as a recommendation, not a fait accompli** ([.apm/skills/loop-full-swe/SKILL.md](.apm/skills/loop-full-swe/SKILL.md)). On the decomposition gate the assistant now presents three paths — run as one loop (override), distribute to issues, or build the breakdown chain — and leads with the single-run override when the split looks like one coherent change cut by file count.

### Added

- **`forceSingleRun` engine arg.** Re-launching with `forceSingleRun: true` overrides the `tooLargeForOneRun` bail so the operator can run the whole request as one plan + build loop. Makes the new "run as one loop instead" choice executable rather than advisory.
- **Engine artifact-hygiene guards** (retro near-misses):
  - **Recycled round-dir reconciliation** (implement-round prompt): round dirs are reused across runs, so before trusting any existing `round-N` start-sha/status.md, the round agent checks `git merge-base --is-ancestor` against live HEAD and re-derives from source if the dir is stale. Prevents a status artifact from asserting a deleted function (e.g. a removed `writeState`) still exists.
  - **Plan self-consistency gate** (plan prompt): a prescribed help/usage/doc string must agree with the plan's own file:line evidence block — a plan may not advertise flags its evidence says a command does not read. Prevents a full wasted churn round.
  - **Summary written against live HEAD** (summary prompt): the commit list must end at live HEAD and the "flagged / not actioned" list is recomputed against the final diff, so the close-out never names itself after a commit it omits or flags items already fixed.
- **Current-state verification rule** in [core.instructions.md](.apm/instructions/core.instructions.md) (and the repo [CLAUDE.md](CLAUDE.md)): the operational corollary to "docs describe current state" — a claim about what a command writes/reads must be confirmed against live source file:line in THIS tree, never carried forward from a prior run summary, status.md, or memory.

### Fixed

- **`financial-preset` test rewritten to the global-only contract** ([test/cases/financial-preset.sh](test/cases/financial-preset.sh)). It had been red since the 0.22.0 global-only merge: it still passed `--scope repo`, asserted repo-local `.claude/skills/`, and asserted a `.agent-kit.yaml` "preset recorded" line — all removed in 0.22.0. Now isolates HOME/USERPROFILE, deploys globally, and verifies the serenity skill + companions land in `~/.claude/skills/` (with `_unshipped/` excluded). Suite is green at 12/12 cases.

## [0.23.0] - 2026-06-11

### Removed

- **The `build-feature-workflow` skill and preset, in full.** It is superseded by `loop-full-swe` (the architecture-aware research→plan→implement+review→retro loop), which covers the same ground. Deleted: the skill (`.apm/skills/build-feature-workflow/` — orchestrator, lib, 13 phase prompts, state template), its preset (`presets/build-feature-workflow.yaml`, also dropped from the wizard's default-selected set in [lib/init.js](lib/init.js)), its design docs (`docs/design/build-feature-workflow-{skill,state-machine}.md`), and its tests (`test/cases/build-feature-workflow-{preset,state-machine}.sh`, `test/lib/build-feature-workflow-fixture-runner.sh`). The shared supporting skills it used (`e2e-validate`, `improve-DDD-architecture`, `improve-codebase-architecture`, `diagnose`, `design-critique`, `web-visual-loop`) are retained — `feature-loop` and `loop-full-swe` still use them; their `/build-feature-workflow`-specific phrasing was scrubbed.

## [0.22.0] - 2026-06-11

The global-only capstone. The kit no longer tracks per-repo state or supports a repo-scoped install — every artifact deploys to your global agent directories, and `agent-kit update` is now just a re-deploy. This release corrects all remaining documentation to describe that current behavior.

### Removed

- **Repo-scoped install and `--scope` support.** Bundles and skills always install globally; there is no `--scope` flag and no per-repo deploy target.
- **Per-repo `.agent-kit.yaml` wizard state** (`writeState`). [lib/state.js](lib/state.js) now exports only `readKitVersion` — nothing writes a per-repo state file, so there is no last-deployed snapshot to diff against.
- **CLAUDE.md merge strategies** — instructions are concatenated inline into `~/.claude/CLAUDE.md` / `~/.codex/AGENTS.md`, overwritten each run.
- **The Codex personal layer** (`AGENTS.override.md`).
- **The stale `promo/` demo artifact** (HyperFrames composition + rendered MP4) — a one-off fun artifact, unreferenced by any code or docs.

### Changed

- **`agent-kit update` is now a stateless global re-deploy.** It re-resolves preset/agents/primitives exactly as `init --default` would (honoring the same `--preset`/`--agents` overrides) and re-runs the idempotent deploy — no per-repo diff, and no `--content-only` / `--adopt-preset-defaults` / `--dry-run` ([lib/update.js](lib/update.js)).
- **`added_in:` frontmatter is metadata only.** It records which kit version a primitive shipped in; the old update-time "new in preset" delta detection that read it is gone, so `agent-kit update` does not consult it ([lib/primitives.js](lib/primitives.js)).
- **Docs corrected to global-only** across [README.md](README.md), the `update` help in [lib/cli.js](lib/cli.js), [docs/maintaining-bundles.md](docs/maintaining-bundles.md), and [.claude/skills/onboard-primitive/SKILL.md](.claude/skills/onboard-primitive/SKILL.md). The README "Spec & Plan" links are relabeled as dated design history.

### Added

- **Global Codex skill deployment** to `~/.agents/skills/<name>/`, each with a manual-only `~/.agents/skills/<name>/agents/openai.yaml` sidecar — now documented in [README.md](README.md) and [.claude/skills/onboard-primitive/SKILL.md](.claude/skills/onboard-primitive/SKILL.md).

## [0.21.0] - 2026-06-11

### Added

- **`financial` preset** ([presets/financial.yaml](presets/financial.yaml)) — a research kit pairing the `core` conduct rule with one new skill: **`serenity-chokepoint-market-research`** ([.apm/skills/serenity-chokepoint-market-research/](.apm/skills/serenity-chokepoint-market-research/)). A source-grounded procedure for mapping a demand trend to the binding supply-chain chokepoint, scoring it, and stress-testing the thesis against current primary sources (it refuses stale data and outputs research, not trading signals). Ships `SKILL.md`, `README.md`, a 20-section `templates/theme_analysis.md`, and a worked `examples/example_power_transformers.md`. New test: [test/cases/financial-preset.sh](test/cases/financial-preset.sh).
- **`_unshipped/` convention for skill assets** ([deploy.js](lib/deploy.js)). A skill folder may now carry an `_unshipped/` subdirectory for maintainer-only provenance/reproducibility files (evidence reports, source corpora) that an agent does not need at use-time. `deploy.js` excludes any `_unshipped/` segment from the recursive copy into consumer repos, so those files stay in the kit repo but never bloat an install. Documented in the `onboard-primitive` maintainer skill. The serenity skill uses it for its 5MB evidence report + cited-post corpus + full retrieved archive.

## [0.20.2] - 2026-06-11

### Fixed

- **Bundle `verify_paths.codex` pointed at the wrong directory** ([gstack.bundle.md](.apm/bundles/gstack.bundle.md), [hyperframes.bundle.md](.apm/bundles/hyperframes.bundle.md)). Codex reads user skills from `~/.agents/skills/`, not `~/.codex/skills/` (the latter holds only Codex's config and bundled `.system` skills). Verified by the upstream `skills` CLI dry-run (`npx skills add ... --agent codex` resolves to `~/.agents/skills/<name>`) and by filesystem inspection (every installed user skill lives under `~/.agents/skills/`, while `~/.codex/skills/` contains only `.system/`). Both bundles declared `codex: "~/.codex/skills/<name>"`, so [verify.js](lib/verify.js) would report a false `MISSING` for any Codex bundle install even when it succeeded. Corrected to `~/.agents/skills/<name>`. Also fixed the bundle-authoring template in [docs/maintaining-bundles.md](docs/maintaining-bundles.md) and the backwards code comments in [deploy.js](lib/deploy.js)/[primitives.js](lib/primitives.js) that called `~/.agents/skills/` "a scratch dir no host reads" — it is, in fact, Codex's user-skill location.

## [0.20.1] - 2026-06-11

### Changed

- **`e2e-validate` now consults project harness-quirks memory before crying "environmental"** ([.apm/skills/e2e-validate/SKILL.md](.apm/skills/e2e-validate/SKILL.md)). Discovery step 1 adds the project's harness-quirks memory (`~/.claude/projects/<repo-key>/memory/*harness*.md`) to the read-before-you-run list, and a new Discipline rule forbids re-deriving a documented quirk as a fresh finding: before labeling a failure "environmental / out of scope" or escalating it to the human, check that memory — if it's documented with a fix, apply it (one-time setup is in scope) or cite it in one line. Folds back the headline lesson from a `loop-retro` run where a documented, one-command-fixable worktree quirk was re-discovered four times and flagged to the human unnecessarily.

## [0.20.0] - 2026-06-09

### Added

- **`teach`** ([.apm/skills/teach/](.apm/skills/teach/)) — a stateful, multi-session teaching skill from [mattpocock/skills](https://github.com/mattpocock/skills) (upstream `2bf7005`, 2026-06-08). Treats the current directory as a teaching workspace: it grounds every lesson in a `MISSION.md` (why the user is learning), draws knowledge only from a curated `RESOURCES.md` rather than parametric guesses, produces self-contained beautiful HTML lessons each teaching one tightly-scoped thing in the user's zone of proximal development, and tracks progress via ADR-style `learning-records/` and a canonical glossary. Five files: [SKILL.md](.apm/skills/teach/SKILL.md) plus the four format specs it links — [MISSION-FORMAT.md](.apm/skills/teach/MISSION-FORMAT.md), [RESOURCES-FORMAT.md](.apm/skills/teach/RESOURCES-FORMAT.md), [LEARNING-RECORD-FORMAT.md](.apm/skills/teach/LEARNING-RECORD-FORMAT.md), [GLOSSARY-FORMAT.md](.apm/skills/teach/GLOSSARY-FORMAT.md). Wired into the `productivity` preset (mirrors upstream's own `skills/productivity/` categorization). Invoke with `/teach <topic>`. New test: [test/cases/teach-skill.sh](test/cases/teach-skill.sh).

### Changed

- On onboarding, the upstream `disable-model-invocation: true` frontmatter flag was **dropped** — in current Claude Code it removes the skill from the model's context, which breaks the `/teach` slash invocation ([claude-code#26251](https://github.com/anthropics/claude-code/issues/26251)). The `name` field was also dropped (the folder name supplies it), matching the existing `prototype` skill onboarded from the same author.

## [0.19.1] - 2026-06-08

### Fixed

- **`loop-swe` engine review/resume correctness, plus a simpler artifact key and progress file** ([loop-swe.js](.apm/skills/loop-full-swe/loop-swe.js)). A review pass surfaced five engine issues, now fixed: (1) review findings were tagged by their post-`filter(Boolean)` index, so a dead reviewer leaf misattributed the discipline of every later finding — findings are now indexed against the unfiltered `reviews` array; (2) review-gate question ids were minted by the digest, which re-runs on resume, so a gated resume could fail to match the human's answer (re-gate loop, or a silently dropped resolution) — ids are now anchored at the cached review step (`r<round>-<reviewer>-<n>`) and the digest carries them verbatim; (3) the `distribute-to-issues` gate omitted `artifactRoot` although every other gate returns it and the continue-after-decomposition runbook needs it; (4) a `code-errors`/`requirements-unmet` validation on the final round settled as `build-done`/`done` with no signal — the terminal gates now carry `validation`, and the `done`/`build-done` SKILL handling flags a non-`passing` status; (5) the per-repo artifact key was a SHA-256 of the toplevel path reproduced byte-identically by three skills (a trailing-newline or casing divergence silently misrouted `/loop-build` and `/loop-retro`) — replaced with a deterministic lowercased path slug stated identically in [loop-full-swe](.apm/skills/loop-full-swe/SKILL.md) and [loop-build](.apm/skills/loop-build/SKILL.md). Also simplified two over-built pieces from 0.19.0: the continue-after-decomposition progress file is now a constant `decomposition.md` under the gate-returned `artifactRoot` (dropping the recomputable-key machinery and its HEAD-sha proof), and the retro run-folder is resolved once by the summary leaf and threaded to the retro leaf instead of each re-deriving it.

## [0.19.0] - 2026-06-08

### Added

- **Opt-in continue-after-decomposition for `/loop-full-swe`** ([.apm/skills/loop-full-swe/SKILL.md](.apm/skills/loop-full-swe/SKILL.md)) — when the engine decides a feature is too large for one build it returns `gate: 'distribute-to-issues'` with a sequenced `issues[]` and previously dead-ended at "feed these to `/to-issues`." A new **"Continuing after decomposition"** section documents a main-agent path that builds the whole breakdown after **one** human OK. The orchestration stays main-agent-driven; the only engine change is a small schema addition — each issue now carries a stable kebab-case `id` (the `ISSUES` contract in `loop-swe.js` requires `id`/`title`/`body`, and `dependsOn` is an array of those ids) so the breakdown is topo-sortable by id rather than by title. The flow: ask the single OK ("build all these in order?") via `AskUserQuestion`; persist a recoverable progress artifact at `~/.loop-swe/<repo-key>/decomposition-<key>.md` (issue list + topo order + a checkbox and Run ID per issue, keyed off a short hash of the feature text so a resumed-after-death chain recomputes the path); then **sequentially**, in `dependsOn` topo order resolved against issue ids, run each issue as its own `Workflow` launch with `stopAfter: 'build'` (no parallel, no worktrees), checking each issue's box on commit. A per-issue run that needs a human stops the chain (downstream depends on it) and resumes after the answer; a per-issue run that *itself* returns `distribute-to-issues` **stops and escalates** — a **one-level re-decomposition cap**, never auto-recursing. After the whole chain, `/loop-retro` runs **once**. Each issue lands as its own commit (failure-isolated); the cost versus internalizing is more tokens (each issue re-scopes itself).

## [0.18.0] - 2026-06-08

### Added

- **`agent-kit init --default`** ([lib/init.js](lib/init.js), [lib/cli.js](lib/cli.js)) — a zero-prompt install that accepts every wizard default and applies without confirmation: the pre-checked preset set (`DEFAULT_SELECTED_PRESETS`), the preset's default agents, and global scope — the "enter through everything" path. Previously the only non-interactive route required passing `--preset`, `--agents`, and `--scope` together. `--default` forces non-interactive mode and each `pick*` step falls back to the same value its interactive prompt would have defaulted to; explicit flags still override individual defaults (e.g. `init --default --scope repo`). New test: [test/cases/init-default.sh](test/cases/init-default.sh).

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
