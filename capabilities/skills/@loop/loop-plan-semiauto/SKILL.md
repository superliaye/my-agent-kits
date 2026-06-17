---
name: loop-plan-semiauto
description: "A minimal-human plan/PRD + acceptance authoring flow that runs BEFORE /loop-build. Same pipeline as /loop-plan-manual — parallel research fan-out -> grill -> draft plan.md + acceptance.md in loop-build's two-block format under ~/.loop-plan/ -> artifact review by the three lens agents — except the grill is /grill-with-committee: a three-lens committee votes on each batched question, a unanimous answer is accepted silently, and only a split or an \"Other\" vote escalates to you. It then STOPS and points you at /loop-build (no auto-handoff). Use when the user says \"/loop-plan-semiauto\", or wants a plan with as little human interaction as the decisions allow (\"if lucky, no human\")."
added_in: 0.33.0
---

# /loop-plan-semiauto

The **minimal-human planner** — "if lucky, no human." It produces exactly what
`/loop-build` wants — a **plan** and an **acceptance doc** in
loop-build's two-block format, so `/loop-build` consumes them directly. You (the
**resident agent**) drive every phase; here the grill lets a **committee vote**, and only
pauses to **you** on a split or an "Other" (`choice: "other"`) vote.

## How to invoke

```
/loop-plan-semiauto add an audit log to the settings service
```

<!-- include: research-fan-out -->

## Phase 2 — Grill (semiauto: `/grill-with-committee`)

Run the `/grill-with-committee` skill — if it isn't installed, stop and tell the user. Seed
it with the research brief's open questions and loop until nothing is open. The committee
resolves what it can by vote and pulls **you** in only on a split or an "Other" — that skill
owns the batching, voting, and consensus rules.

<!-- include: draft-to-loop-build-format -->

<!-- include: artifact-review -->

## Phase 5 — Hand off to the user

Print the exact `plan.md` + `acceptance.md` paths you wrote (this run's per-run folder),
summarise any review findings you dismissed (and any question the committee escalated), and
tell the user to run **`/loop-build`** when they're ready — it picks these up directly.
