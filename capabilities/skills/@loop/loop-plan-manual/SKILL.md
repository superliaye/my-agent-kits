---
name: loop-plan-manual
description: "A human-in-the-loop plan.md + sparse acceptance.md authoring flow before /loop-build. It runs parallel research, puts every release decision to the human through /grill-with-docs, defers evidence-dependent mechanisms as plan hypotheses, and reviews the artifacts before stopping with exact paths. Use for /loop-plan-manual or a fully human-decided plan before building."
added_in: 0.33.0
---

# /loop-plan-manual

The **human-in-the-loop planner**. It produces exactly what
`/loop-build` wants — a **plan** and an **acceptance doc** in
loop-build's two-block format, so `/loop-build` consumes them directly with no further
drafting. You (the **resident agent**) drive every phase; here the grill puts **every
release decision to the human**.

## How to invoke

```
/loop-plan-manual add an audit log to the settings service
```

<!-- include: research-fan-out -->

## Phase 2 — Grill (manual: `/grill-with-docs`)

Run the `/grill-with-docs` skill — if it isn't installed, stop and tell the user (don't
improvise the grill). Seed it with the research brief's release decisions and loop until no
decision required to define the outcome or safely start implementation remains open.
Evidence-dependent branches are already resolved as implementation hypotheses. Every release
decision goes to **you** — that human-in-the-loop grill is the whole point of this variant; the
grill skill owns how it runs.

<!-- include: plan-contract -->

<!-- include: acceptance-contract -->

<!-- include: draft-to-loop-build-format -->

<!-- include: artifact-review -->

## Phase 5 — Hand off to the user

Print the exact `plan.md` + `acceptance.md` paths you wrote (this run's per-run folder),
summarise any review findings you dismissed, and tell the user to run **`/loop-build`** when
they're ready — it picks these up directly.
