---
name: loop-plan-manual
description: "A human-in-the-loop plan/PRD + acceptance authoring flow that runs BEFORE /loop-build, so the build step consumes ready artifacts instead of drafting them from context. The resident drives four phases: parallel research fan-out -> /grill-with-docs (you answer every question) -> draft plan.md + acceptance.md in loop-build's two-block format under ~/.loop-plan/ -> artifact review by the three lens agents. It then STOPS and points you at /loop-build (no auto-handoff). Use when the user says \"/loop-plan-manual\", or wants a thorough, fully-human-reviewed plan before building."
added_in: 0.33.0
---

# /loop-plan-manual

The **human-in-the-loop planner**. It produces exactly what
`/loop-build` wants — a **plan** and an **acceptance doc** in
loop-build's two-block format, so `/loop-build` consumes them directly with no further
drafting. You (the **resident agent**) drive every phase; here the grill puts **every
question to the human**.

## How to invoke

```
/loop-plan-manual add an audit log to the settings service
```

<!-- include: research-fan-out -->

## Phase 2 — Grill (manual: `/grill-with-docs`)

Run the `/grill-with-docs` skill — if it isn't installed, stop and tell the user (don't
improvise the grill). Seed it with the research brief's open questions and loop until
nothing is open. Every question goes to **you** — that human-in-the-loop grill is the whole
point of this variant; the grill skill owns how it runs.

<!-- include: draft-to-loop-build-format -->

<!-- include: artifact-review -->

## Phase 5 — Hand off to the user

Print the exact `plan.md` + `acceptance.md` paths you wrote (this run's per-run folder),
summarise any review findings you dismissed, and tell the user to run **`/loop-build`** when
they're ready — it picks these up directly.
