---
name: loop-check-readiness
description: Read-only audit of whether a coding agent can actually get a fast, deterministic, agent-runnable feedback loop in a repo — judging both what the repo affords (tests, build, type-check, lint, CI, and a reachable, drivable UI for visual checks) and whether the agent can close that loop unattended with the tools and skills it has (no interactive auth, human clicks, or non-headless steps). Reports gaps and opportunities with a remediation for each; it inspects and reports only, changing no files and building no loop. Use when starting work in an unfamiliar repo, when the user asks whether a project is set up for success or has a good feedback loop, or to audit or grade its feedback signals before relying on an agent loop.
allowed-tools: Read, Grep, Glob, Bash
added_in: 0.28.0
---

# Loop check readiness

A coding agent only succeeds when it can get a **fast, deterministic, agent-runnable pass/fail
signal** for the changes it makes. Whether it can comes down to two things meeting: what the
repo affords, and what *this* agent can actually do with the tools and skills it has. This skill
audits both halves and reports where they fail to meet. It judges the repo's standing capacity,
not one specific bug — and it proposes, it never scaffolds.

## The rubric

A signal is good when it is:

- **Present** — a real command the repo ships, not one you invented.
- **Fast** — tight enough to run every iteration.
- **Deterministic** — same input, same verdict; matches the CI gate; no flake.
- **Agent-runnable** — *you*, headless, with the capabilities you have, can run it end to end and
  read the result. A step that needs a human — interactive auth, a click, the user's
  credentials, a GUI that won't launch headlessly — breaks the loop even when it's set up for a
  person.

That last pillar is where repo and agent meet, and it's the one people forget. Count the
capabilities you actually have — including user-scope skills you carry between repos, like
visual-loop or browser-driver tooling. A repo is a good sign when it lets you exercise them: a
documented run command, a headless path, auth you can seed. It's a bad sign when its only route
to a signal is one you can't take.

## What to check

- **Dev loop** — tests, build, type-check, lint. Is each a real, discoverable command? Where
  cheap and safe, run it once to confirm it's real and time it; declared is not working. In a
  monorepo the real harness is per-package, not at the root.
- **Visual loop** (only if the repo renders UI) — can you actually get pixels, headless, with no
  human in the auth path? If the UI renders but nothing you have can capture it, that's a gap —
  "the code looks right" is not evidence.

Discover, don't invent: grade whatever the repo ships (build files, CI config,
`CLAUDE.md`/`AGENTS.md`, any harness-quirks memory), in any stack. Never run something with side
effects or that won't exit on its own.

## Report

For each loop, a one-line verdict — healthy / weak / missing — then:

- **Gaps** — no usable signal, or the only path needs a human the agent can't be.
- **Opportunities** — a signal exists but is slow, flaky, ungated, or needs a capability you have
  that the repo doesn't make reachable.

Pair every finding with a concrete remediation, grounded in a real `file:line` or a named
missing file. A missing or unreachable signal is a finding, never a silent "looks fine."
