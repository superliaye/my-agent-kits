# loop-build (rebuild) — design

A greenfield rebuild of the day-to-day "build" flow as **one resident-facing skill
plus two nested agents**, using Claude Code's now-supported nested sub-agent
spawning (v2.1.172+). The resident agent agrees on *what ready means*, spawns a
**build agent** that executes the plan, gates the build on a **build-acceptance
agent** before any code review, runs the **review committee**, incorporates
feedback, and returns a structured summary upward.

## Why greenfield (and what it replaces)

The existing `/loop-build` is a thin segment of the `loop-swe.js` workflow engine.
That engine puts all fan-out in a Workflow *script* because it was written against
the old **depth=1** sub-agent limit. That limit no longer holds: as of Claude Code
**v2.1.172**, a sub-agent that has `Agent` in its tools list can spawn its own
sub-agents — foreground at any depth, background capped at depth 5
(`https://code.claude.com/docs/en/sub-agents.md`). This lets the build agent *itself*
orchestrate its children, which is the topology this flow wants.

- The old `/loop-build` skill is **renamed and deprecated** — it is *not* replaced by
  the new skill. The new `loop-build` is a different capability that happens to claim
  the canonical name; everything that depended on the old skill must follow it to its
  new deprecated name. See [Migration](#migration). 
- `loop-swe.js`, `/loop-full-swe`, `/loop-research-plan`, `/loop-retro` keep working
  against the renamed deprecated skill; their docs assert a false depth=1 limit and
  should be corrected separately.

## Topology

```
resident agent  ── skill: loop-build (readiness gate · escalation broker · final relay)
   └─ agent: loop-build-agent           (foreground; has Agent, Skill, Edit/Write/Bash, Read/Grep/Glob)
        ├─ agent: loop-build-acceptance  (spawned each acceptance round; verify-only, no Edit)
        │     ├─ skill: e2e-validate                         (non-visual / functional criteria)
        │     └─ skill: web- | electron- | desktop-visual-loop  (visual criteria, routed by env)
        └─ skill: loop-review-committee  (fans out the 3 @code-reviewers in parallel)
```

All calls run **foreground**, so the chain is self-limiting and stays under the
depth-5 background cap regardless. The build agent **must** list `Agent` in its tools
or its spawns silently no-op. `loop-build-acceptance` and the reviewer agents spawn
nothing.

## Components

### 1. Skill `loop-build` (resident entry point)
Path: `capabilities/skills/@loop/loop-build/SKILL.md` (replaces the deprecated one).

Responsibilities:
1. **Readiness gate** — resolve the plan and the acceptance criteria from context
   (see [Entry modes](#entry-modes)). No enforced artifact path; the resident finds
   them wherever they are (a named file, the conversation, a prior plan session).
2. **Spawn the build agent**, baking plan + acceptance criteria + the review
   fixed-point + the round cap **into the spawn prompt** — the prompt is the contract.
3. **Broker escalations** — when the build agent returns at the round cap with failing
   criteria, surface them to the user with `AskUserQuestion`, then re-spawn/continue.
4. **Relay the final structured summary** ([Return contract](#return-contract)).

### 2. Agent `loop-build-agent`
Path: `capabilities/agents/@loop/loop-build-agent/AGENT.md` (named distinct from the `loop-build` skill).
Tools: `Agent, Skill, Read, Edit, Write, Bash, Grep, Glob`.

The orchestrator. Behaviour in [The build loop](#the-build-loop).

### 3. Agent `loop-build-acceptance`
Path: `capabilities/agents/@loop/loop-build-acceptance/AGENT.md`.
Tools: `Skill, Read, Bash, Grep, Glob` (**no Edit** — it verifies, it does not fix).

Reads the acceptance criteria from its spawn prompt and checks **both** blocks:
- **Non-visual** — runs the verification each criterion names (tests, `e2e-validate`,
  a CLI/API assertion). 
- **Visual** — detects the UI env and routes to `web-visual-loop`,
  `electron-visual-loop`, or `desktop-app-loop`; drives the route/state each criterion
  names and verifies the observable outcome.

Returns **per-criterion** `{criterion, status: pass|fail, evidence, notes}`, plus a
top-level `working[]` / `not-working[]` split. Rules:
- Empty visual block → skip the visual half.
- Both blocks empty → return `nothing-to-verify` (the build agent then skips
  acceptance entirely).
- **No silent pass.** If a criterion has no runnable signal in the repo (no test/build
  harness, UI not reachable headless), report it as `fail` with reason
  `no-harness`, not `pass`. (Mirrors `loop-check-readiness`; a missing verification
  signal is a finding.)

### Reused as-is (no new code)
- `loop-review-committee` skill + the 3 `@code-reviewers` agents (architecture-review,
  rules-enforcer, general-review).
- `@feedback-loops` skills (web / electron / desktop).
- `e2e-validate` skill.

## The acceptance doc

One document, two criteria blocks. Produced by the plan session (Mode A) or agreed
with the user (Mode B). Carried into the build agent's prompt.

```markdown
## Non-visual acceptance     (present whenever behaviour changes)
- [ ] <observable behavioural outcome> — verify: <cmd / test / assertion>

## Visual acceptance          (REQUIRED when the change involves visuals)
- [ ] <observable UI outcome> — env: web|electron|desktop — at: <route/state>
```

A style-only change has visual criteria and few/no non-visual ones; a pure-logic
change is the reverse. The build agent never invents criteria — it builds to satisfy
exactly these.

## Entry modes

- **Mode A — artifacts exist.** A prior research/plan session produced the plan and the
  acceptance doc. The resident confirms both are present and current → spawns build
  with **no user interaction**.
- **Mode B — invoked cold.** The resident drafts the plan + acceptance doc by reasoning
  over the session context, asks the user **only to resolve genuine gaps**, gets
  agreement, then spawns build.

Both modes converge on the same spawn: a build agent whose prompt carries an agreed
plan and an agreed acceptance doc.

## The build loop

Inside the `loop-build-agent`. Strict ordering — **acceptance is a hard gate before
review**:

1. **Implement** the plan as-is (bounded implementation rounds).
2. **Spawn `loop-build-acceptance`** → get the working / not-working split.
3. **Gate.** Iterate steps 1–2 until acceptance **fully passes**, bounded to **N
   acceptance rounds** (default N=3, set by the resident in the prompt). If still
   failing at the cap → **stop and return** to the resident with the failing criteria,
   a diagnosis, and what was tried. Do not proceed to review on a broken experience.
4. **Review.** Once acceptance passes, invoke `/loop-review-committee` with an explicit
   fixed-point (the base the build started from) so it never blocks asking "review
   against what?". The committee returns findings grouped by reviewer.
5. **Incorporate.** The build agent **judges findings directly** (no adversarial
   verify) and applies the ones it accepts. If a fix could regress acceptance, re-run
   step 2 (bounded).
6. **Return** the structured summary upward.

## Return contract

`loop-build-agent` → resident → user:

| Field | Contents |
|---|---|
| `executed` | What was implemented — diff summary, commits, files touched. |
| `achieved` | Acceptance criteria now passing (with evidence). |
| `still-missing` | Failing/unaddressed criteria + why; anything escalated at the cap. |
| `dismissed-feedback` | Committee findings **not** applied + the rationale. |
| `harness-improvements` | Meta-notes: gaps in the acceptance doc, missing test/visual harness, friction in the skills/agents/loop itself. |

## Migration

The old skill is **renamed to a deprecated name and kept** (the loop-swe engine still
needs it); the new `loop-build` takes the canonical path. The new skill is **not** the
target for the old inbound references — each must be repointed to the renamed skill.

### Rename the old skill
- Move `capabilities/skills/@loop/loop-build/` → a deprecated name. Proposed:
  **`loop-swe-build`** (it *is* the loop-swe implement+review segment) — confirm the
  name at implementation.
- Mark it deprecated: `deprecated: true` in frontmatter + a one-line notice that the
  day-to-day build flow now lives in the new `/loop-build`, while this stage remains the
  loop-swe engine segment.
- The new resident-entry skill then takes `capabilities/skills/@loop/loop-build/`.

### Repoint every inbound reference to the renamed skill
The new `loop-build` must not silently inherit these — they belong to the loop-swe
segment, which is now `loop-swe-build`:

- `capabilities/skills/@loop/loop-full-swe/SKILL.md` — `../loop-build/SKILL.md` link + the
  description's `/loop-build` mention.
- `capabilities/skills/@loop/loop-full-swe/EXECUTION.md` — multiple `/loop-build` mentions
  (stage table, artifact-resolution prose, terminal-success section).
- `capabilities/skills/@loop/loop-full-swe/FLOW.md` — the `/loop-build` subgraph label.
- `capabilities/skills/@loop/loop-full-swe/loop-swe.js` — the `/loop-build` header/comment
  references.
- `capabilities/skills/@loop/loop-research-plan/SKILL.md` — two `../loop-build/SKILL.md`
  links + prose ("ready for /loop-build", "/loop-build resolves the same folder").
- `capabilities/skills/@loop/loop-retro/SKILL.md` — the `../loop-build/SKILL.md` link.
- `presets/loop-full-swe.yaml` — the `loop-build` entry in the skills list.
- `test/cases/loop-full-swe-preset.sh` — asserts the deployed `loop-build` path + the
  stage loop (`for s in loop-full-swe loop-research-plan loop-build loop-retro`).
- `CHANGELOG.md` — **do not rewrite history**; add a *new* entry recording the rename +
  deprecation and the new skill.

A grep for `loop-build` across the tree must return only: the new skill, the two new
agents, the renamed `loop-swe-build` skill, and references that *intentionally* point to
one of those. No reference should resolve to the old path by accident.

## Open items

1. **`loop-review-committee` is resident-facing today** (it asks the user for a
   fixed-point and presents findings to a human). Used by the build agent it must run
   **non-interactively**: the build agent supplies the fixed-point and consumes the
   returned findings instead of presenting them. Confirm the committee skill returns
   findings cleanly when driven by an agent rather than a human.
2. **Packaging.** Which preset ships the new skill + two agents (e.g. alongside the
   `@code-reviewers` / feedback-loops bundle), and the dependency wiring.
3. **`loop-swe.js` family docs** assert a stale depth=1 limit; correct separately.

## Out of scope

The behaviour of the `loop-swe.js` engine and the `/loop-full-swe`,
`/loop-research-plan`, `/loop-retro` skills — beyond the rename + reference repointing
in [Migration](#migration) and noting the stale depth claim. Their logic is unchanged;
only their pointer to the old `loop-build` moves.
