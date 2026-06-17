# my-agent-kits — authoring rules

This repo is a **capability kit**: skills (`SKILL.md`), agents (`AGENT.md`), and shared
`snippets/` under `capabilities/`, shipped by `presets/*.yaml` and deployed to a user's
global agent dirs (`~/.claude/`, `~/.codex/`, …) by `bin/agent-kit`. These rules govern
authoring those capabilities — a checklist, not a style guide: each line exists to stop a
specific way a capability fails.

## A capability body is read by the executing agent, not a maintainer

Every line of a `SKILL.md` / `AGENT.md` / inlined snippet is loaded into the consumer's
context and spends its tokens and attention. Write instructions for the executor; **cut
maintainer-facing prose** — how the file relates to other capabilities ("a thin skill, not
a segment of X", "shares phases with Y"), cross-system jargon the consumer never touches,
and `## Dependencies` / "Shipped via `<preset>`" footers. The preset YAML drives
deployment; the prose ships nothing.

## One agent, one job

A deployed agent is a **single static file** — the spawn prompt can add a task but cannot
strip the file's other content, so a dual-purpose agent carries dead weight on every
invocation. Give each agent one job. Share only the genuinely-common part (a perspective, a
contract) via a snippet; keep everything else in the consumer that needs it.

Need an agent for a *different* task? **Set that task in the spawn prompt and reuse it** —
don't fork its body. The agent's body is its lens/identity (its one job); a caller supplies
the alternate task. (The `@reviews` agents vote in the grill committee via a vote-prompt from
`/grill-with-committee`, staying review-only — their lens is defined once and reused, not
copied.)

## Trust the agent's judgment; don't over-specify

Don't restate a shared contract, and don't add mechanical rubrics the agent can infer
(e.g. a literal-wording → severity table). **Prefer positive instructions over defensive
negations** — don't say "don't do X" when X isn't something the agent would do unprompted
("don't auto-handoff to the build"); the warning only plants the idea and spends words.
State the lens/goal once and let judgment do the rest. Lean bodies are less brittle and
cheaper to load.

## Compose by invocable name; fail fast if it's missing

A skill **may, and often must, invoke other capabilities** — the resident has the Skill
tool; composition is the point, not a smell. Reference them by **invocable name**
(`/grill-with-docs`, the `loop-review-committee` skill), **never** by a repo-relative path
like `../../@matt-pocock/grill-with-docs/SKILL.md`: the deployed layout is flat and
per-machine, so that path resolves to nothing at runtime. Assume the capability is installed
in the harness and **fail fast if it isn't** — stop and tell the user which capability to
install, rather than improvising or running a partial flow.

Reference a sibling to *invoke* it, not to borrow its words: for shared **text** (a
contract, a phase) inline a snippet `<!-- include: name -->` instead of pointing the reader
at another file. And when you *do* invoke a skill or spawn a sub-agent, **don't re-describe
what it does** — give it its input and the stop condition, then trust it. A copied
description of its lens or its output contract is dead weight that drifts the moment that
capability changes (a named agent already carries its own job; only an unspecialised
`general-purpose` agent needs its instructions injected).

## Interactive flows are resident-driven; spawned agents are autonomous leaves

A spawned sub-agent (`Agent(...)`) **returns once and cannot hold a multi-turn dialogue with
the user** — so any flow that interrogates the human (a grill, a readiness gate) must be
driven by the **resident** skill, which fans sub-agents out only for the autonomous leaves
(parallel research, a voting committee, a review pass). Don't model an interactive flow as a
spawned orchestrator agent; it can't pause to ask. And an agent that spawns others must list
**`Agent` in its tools** — without it the spawns **silently no-op** (no error), so the
orchestration just doesn't happen.

## Names are the wiring; folders are cosmetic

A skill/agent resolves by its frontmatter `name:`, not its folder. **Renaming or moving a
folder is safe; changing a `name:` breaks every `subagent_type` reference, the manifest
`agentDefs`, and the presets.** Keep each `name:` unique and stable.

## DRY and shipping are mechanical, not prose

Shared text lives in `capabilities/snippets/` and is pulled in with `<!-- include: name -->`,
expanded at deploy — a `SKILL.md` include is **strict** (an unknown marker fails the
deploy). A capability ships only if a `presets/*.yaml` lists it, and its frontmatter must
carry `added_in: <version>`.

## Stateful skills isolate per run and hand off explicit paths

A skill that writes artifacts for a later step to consume must assume **concurrent runs and
leftover artifacts** in the same repo. Write under a **per-run key** (a topic slug, made
unique) — never a fixed path — so parallel and prior runs don't collide, and **print the
exact path** so the consumer (the user, a later skill) targets *this* run's output instead
of guessing a default. (`/loop-plan-semiauto` does this as `~/.loop-plan/<repo-key>/<run-key>/`.)

## Verify by deploying, not by reading

CC capabilities are process- not result-deterministic: **assert structure and run the
deploy/roundtrip suite**, then eval quality by dogfooding. Run an isolated case directly
(`bash test/cases/<case>.sh` — each self-isolates `$HOME`) or the whole suite with
`AGENT_KIT_TEST_HOST=1 bash test/run-tests.sh`. Never claim a capability works from reading
the source.
