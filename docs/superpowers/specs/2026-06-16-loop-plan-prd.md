# loop-plan — PRD (build scope: full feature)

Source design: [2026-06-16-loop-plan-design.md](2026-06-16-loop-plan-design.md). This
PRD is the change to build, per-item. New capabilities use `added_in: 0.33.0` (kit is
at 0.32.0). The three existing agents are *modified*, not added — keep their
`added_in: 0.31.0`.

Namespace recommendations (the build agent may relocate to match conventions): the two
plan skills and `grill-with-committee` under `capabilities/skills/@loop/`; new snippets
under `capabilities/snippets/`.

> **Revised after the build:** the three `@reviews` agents are **review-only** and
> **self-contained** (no shared lens snippet — `architecture-review` applies the two
> `/improve-*` skills, `rules-enforcer` enforces documented rules, `general-review` reasons
> from first principles). The grill committee is separate: `/grill-with-committee` spawns three
> `general-purpose` voters, each given a one-line lens inline. Slice 1 item 3 and Slice 2 below
> describe the original dual-task shape; see the design spec for the current one.

## Slice 1 — Reviewer agents: pivot + generalize

1. **Move `capabilities/agents/@code-reviewers/` → `capabilities/agents/@reviews/`.**
   Keep the three agent folders and their `name:` fields unchanged
   (`architecture-review`, `rules-enforcer`, `general-review`) so every
   `subagent_type` reference, preset entry, and manifest `agentDefs` name stays wired.
   *Intent:* a namespace that reads right now the agents review/answer about anything.

2. **Rewire every live reference to the old folder path** (`@code-reviewers` /
   "code-reviewers"): loop-build `FLOW.md`, `loop-build-agent/AGENT.md`, loop-build
   `SKILL.md`, `loop-review-committee/SKILL.md`, `improve-codebase-architecture/SKILL.md`,
   and the explanatory comments in `test/cases/agents-deploy.sh` +
   `agents-update-roundtrip.sh`. Historical records are exempt — `CHANGELOG.md` and the
   dated design specs are point-in-time; do not rewrite them (add a new CHANGELOG
   entry). *Intent:* docs describe current state.

3. **Generalize the three agent bodies to be task-agnostic.** Each AGENT.md fixes a
   **lens** and supports two **tasks** chosen by the spawn prompt:
   - `architecture-review` → structure/design lens.
   - `rules-enforcer` → rules/constraints lens.
   - `general-review` → first-principles lens.

   Task (a) **review an artifact** → findings per `review-finding-contract` (keep this
   include). Task (b) **answer a grilled question** → a vote per the new
   `committee-answer-contract` (add this include). When the artifact is code the lenses
   behave exactly as today (e.g. `architecture-review` still runs
   `/improve-codebase-architecture` + `/improve-DDD-architecture`); for a plan/PRD or a
   grill question the lens generalizes. *Intent:* one set of agents serves both the
   grill committee and artifact review.

4. **Add snippet `capabilities/snippets/committee-answer-contract.md`** — each agent
   returns, per question, `{ choice: <option-id|"other">, rationale, evidence,
   proposed? }`. Sibling of `review-finding-contract`. *Intent:* mechanical consensus
   (string-equality on `choice`, no `"other"`).

## Slice 2 — /grill-with-committee (reusable grill skill)

5. **New skill `grill-with-committee`**, built on `/grill-with-docs`. Per round: select
   a batch of **mutually-independent** questions (a question gated on an earlier answer
   waits for a later batch); frame each with **2–4 options + "Other"**; spawn the 3 lens
   agents (`subagent_type` `architecture-review` / `rules-enforcer` / `general-review`,
   task = answer, `committee-answer-contract`) to vote. **Consensus = all 3 chose the
   same enumerated option → accept silently; any split or any "Other" → escalate** to
   the inviting agent. Loop until clear. Standalone, it writes a `grill.md` digest with
   provenance (`committee` | `human`). *Intent:* the semiauto grill engine; usable on
   its own or embedded.

## Slice 3 — Shared snippets for the plan skills

6. **Add shared-phase snippets** so the two plan skills don't duplicate scaffolding: a
   research-fan-out snippet, a draft-to-loop-build-format snippet, and an
   artifact-review snippet. *Intent:* the only real difference between `-manual` and
   `-semiauto` is the grill phase.

## Slice 4 — /loop-plan-manual

7. **New skill `loop-plan-manual`** — resident-driven: research fan-out (parallel
   codebase/web sub-agents + `deep-research` for time-sensitive facts) → `/grill-with-docs`
   → draft `plan.md` + `acceptance.md` (loop-build's two-block format) to
   `~/.loop-plan/<repo-key>/` (overridable) → artifact review (the 3 lenses; resident
   judges + revises, bounded ~2 rounds; surfaces dismissals) → **stop**, point the user
   at `/loop-build` (no auto-handoff). Includes the shared snippets. *Intent:*
   human-in-the-loop planner.

## Slice 5 — /loop-plan-semiauto

8. **New skill `loop-plan-semiauto`** — identical pipeline to `-manual`, except the
   grill phase is `/grill-with-committee` (committee votes; split or `"Other"` → ask the
   user). Includes the shared snippets. *Intent:* minimal-human planner; "if lucky, no
   human."

## Slice 6 — Wiring

9. **Register + ship.** Wire the new skills + snippets so they deploy (follow
   `onboard-capability` conventions). Add the new skills/agents to the natural preset
   (`presets/loop-full-swe.yaml`). Add a `0.33.0` `CHANGELOG.md` entry covering the
   loop-plan family + the `@reviews` rename. Confirm deploy still works end-to-end.
   *Intent:* shipped, discoverable, and green.
