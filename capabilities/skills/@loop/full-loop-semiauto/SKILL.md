---
name: full-loop-semiauto
description: "End-to-end semiauto loop: chains /loop-plan-semiauto -> /loop-build -> /loop-retro. The planner drafts plan hypotheses plus sparse acceptance through a committee-voted grill; the build gates review on that exact contract and escalates semantic defects; the retro mines the run for capability improvements. Use for /full-loop-semiauto or a minimal-human plan-to-build-to-retro pass."
added_in: 0.41.0
---

# /full-loop-semiauto

The whole semiauto loop in one command: you (the **resident agent**) invoke three skills in
order with the `Skill` tool. Each runs in your shared context, so it picks up where the
last left off — you don't marshal anything between them.

## How to invoke

```
/full-loop-semiauto add an audit log to the settings service
```

1. `/loop-plan-semiauto`
2. `/loop-build`
3. `/loop-retro`

If one isn't installed, stop and name it — don't run a partial chain. If a step escalates
to the human, resolve it and resume from there.
