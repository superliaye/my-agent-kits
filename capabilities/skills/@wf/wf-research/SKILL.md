---
name: wf-research
description: Codebase-first research primitive. Use at the START of a feature request or a bug fix, before planning, to produce a "raw research brief" — a grounded map of the problem area (relevant code at file:line, how it works today, constraints, open questions) with NO proposed directions, to feed a downstream grill or plan. Does light web search inline and escalates to deeper web research only for time-sensitive facts. Runs fully autonomously as a file-based dynamic Workflow and writes the brief under ~/.wf/<repo>/research/.
added_in: 0.28.0
---

# wf-research

Given a feature request or a bug, produce a **raw research brief** — a grounded map of the
problem area that grounds a downstream grill or plan. It is *raw*: an input to refine, not
a deliverable, and it deliberately **proposes no directions or solutions** (that would
narrow the grill it feeds).

This skill is a thin launcher for a file-based dynamic Workflow that does the work.

## Run it

Launch the bundled workflow on the user's request:

```
Workflow({
  scriptPath: "<this skill folder>/wf-research.workflow.js",
  args: { request: "<the feature request or bug, verbatim>" }
})
```

`<this skill folder>` is wherever this SKILL.md was loaded from (e.g.
`~/.claude/skills/wf-research/`). The workflow runs in the background and returns
`{ gate, briefPath, openQuestions, deferredWebNeeds, stats }`.

When it completes:
- Report the `gate` (`done` / `brief-degraded` / `research-failed`) and the `briefPath`.
- If `gate` is `done`, the file at `briefPath` is the deliverable — offer to read it,
  start a grill on it, or plan from it.
- Do **not** add directions or solutions yourself — the brief stops short of them on
  purpose so a downstream grill/plan decides.

## What it produces

The brief: restated problem · problem-area map (`file:line`) · how-it-works-today ·
constraints/risks · cited time-sensitive web facts (only if it escalated) · open questions
& tensions. No proposed directions.

It runs fully autonomously: it never interrogates the user mid-run; ambiguity becomes an
open question in the brief.
