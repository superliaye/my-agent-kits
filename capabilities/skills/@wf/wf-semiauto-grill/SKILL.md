---
name: wf-semiauto-grill
description: Semi-automated grill on a plan or design. Use after research / before planning to stress-test a design when the repo already has guardrails (CLAUDE.md, ADRs, CONTEXT, tastes). It asks one dependency-aware question at a time, auto-answers the ones the harness already decides (citing the rule), flags the ones it must assume, and pauses to the user only for genuine decisions. Produces per-Q&A artifacts + a grill.md digest and a harness/skill feedback backlog. Runs as a resumable file-based Workflow; needs only a brief.md — from wf-research, an existing brief, or a /handoff of the session.
added_in: 0.29.0
---

# wf-semiauto-grill

Stress-test a plan or design like a relentless reviewer, but let the repo's own harness answer
the questions it already decides. One question at a time; the user is pulled in only for the
decisions the harness genuinely leaves open.

This skill is a thin launcher. The grilling, voting, and artifact-writing run inside a
file-based dynamic Workflow; the main agent only ensures a brief exists and bridges the
user on the questions that escalate — so the main context stays lean.

## Run it

### 1. Ensure a `brief.md` exists

The Workflow grills against a brief; its source is open. Pick the first that applies:

- **An existing `brief.md`** (e.g. a prior `wf-research` run) — use its path.
- **No brief, and deeper grounding is wanted** — run `wf-research` first (a separate
  Workflow) and use its `briefPath`.
- **No brief, but the session already has the context** — write a brief from the session: run
  the `handoff` skill (or summarise the discussion) into a `brief.md` and use that path. A
  thin brief is fine; the grill sharpens it.

If a prior `wf-research` ran in the **same run** (you hold its `runDir`), pass that `runDir` and
omit `briefPath` — the grill auto-reads `<runDir>/research/brief.md`.

### 2. Launch the grill Workflow

```
Workflow({
  scriptPath: "<this skill folder>/wf-semiauto-grill.workflow.js",
  args: { briefPath: "<absolute path to brief.md>" }   // optionally: runDir, to join an existing run
})
```

It returns `{ gate, runDir, ... }`. Handle the gate (below), looping until `done`.

### 3. When it pauses for you — `gate: "needs-human"`

The Workflow stopped because the panel could not resolve one question (`reason`: `split`,
`human-call`, or `panel-degraded`). The result carries `question`, `recommendation`,
`recommendationWhy`, `why`, `reason`, `tentative` (the panel's votes), `seq`, `slug`, `runDir`,
and `harnessGapDraft`. Do:

1. **Ask the user** that one `question` — show the questioner's `recommendation` and the
   `tentative` votes so they decide with context. Keep it to this single question.
2. **Relaunch with their answer.** Pass it back; the script writes the human Q&A and the
   harness-gap feedback for you (checker-gated) — do NOT hand-write those files.

```
Workflow({
  scriptPath: "<this skill folder>/wf-semiauto-grill.workflow.js",
  args: {
    briefPath: "<same brief.md>",
    runDir: "<runDir from the result>",
    humanAnswer: {
      seq, slug, question, recommendation, recommendationWhy, why,   // echo these from the result
      answer:  "<the user's decision>",
      context: "<any extra context the user gave>",
      reason:  "<the result's reason>"
    }
  }
})
```

The relaunched run records the decision (provenance `human`) and the harness gap, then continues
to the next question. Loop until `done`.

### 4. When it finishes — `gate: "done"` (or `grill-degraded`)

Read `digestPath` (`grill.md`) — the cornerstone, with the resolved decisions and the full Q&A
transcript. Then:

- Summarise the resolved decisions, and **call out the `assumed` items** — those were
  auto-answered from a default with no harness rule and are worth a glance.
- Point at the **feedback backlog** (`<runDir>/grill/feedback/` + `~/.wf/<repo>/feedback/`): each
  harness-gap is a proposed guardrail that would auto-resolve that question next time.
- Offer to plan from `grill.md`.

`degraded` / `aborted` gates: report the `problems` and the `runDir`; nothing was silently
dropped.

## What it produces

Per-Q&A write-once files in `<runDir>/grill/qa/` (each: question, the questioner's
recommendation, the panel's decision, provenance, panel), the assembled `<runDir>/grill/grill.md`
cornerstone, and a harness/skill feedback backlog. Provenance is always explicit: `grounded`
(a cited harness rule), `assumed` (a flagged default), or `human`.

<!-- include: wf-feedback-protocol -->
