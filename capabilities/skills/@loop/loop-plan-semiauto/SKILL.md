---
name: loop-plan-semiauto
description: "A minimal-human plan.md + sparse acceptance.md authoring flow before /loop-build. It runs parallel research, lets a three-lens committee resolve release decisions when unanimous, defers evidence-dependent mechanisms as plan hypotheses, and reviews the artifacts. A split, an \"Other\" vote, or a proposed semantic acceptance change escalates to the human. It stops with exact artifact paths. Use for /loop-plan-semiauto or a plan with minimal human interaction."
added_in: 0.33.0
---

# /loop-plan-semiauto

The **minimal-human planner** — "if lucky, no human." It produces exactly what
`/loop-build` wants — a **plan** and an **acceptance doc** in
loop-build's two-block format, so `/loop-build` consumes them directly. You (the
**resident agent**) drive every phase; the grill lets a **committee vote** and pauses for a split,
an "Other" (`choice: "other"`) vote, or a reviewer proposal that changes acceptance semantics.

## How to invoke

```
/loop-plan-semiauto add an audit log to the settings service
```

<!-- include: research-fan-out -->

## Phase 2 — Grill (semiauto: `/grill-with-committee`)

Run the `/grill-with-committee` skill — if it isn't installed, stop and tell the user. Seed
it with the research brief's release decisions and loop until no decision required to define the
outcome or safely start implementation remains open. Evidence-dependent branches are already
resolved as implementation hypotheses. The committee resolves what it can by vote and pulls
**you** in only on a split or an "Other" — that skill owns the batching, voting, and consensus
rules. Committee agreement settles a planning decision; it never qualifies an outcome for acceptance
without the sparse contract's authority test.

<!-- include: plan-contract -->

<!-- include: acceptance-contract -->

<!-- include: draft-to-loop-build-format -->

<!-- include: artifact-review -->

## Phase 5 — Hand off to the user

Print the exact `plan.md` + `acceptance.md` paths you wrote (this run's per-run folder),
summarise any review findings you dismissed (and any question the committee escalated), and
tell the user to run **`/loop-build`** when they're ready — it picks these up directly.
