---
name: full-loop-semiauto
description: "End-to-end semiauto loop: chains /loop-plan-semiauto -> /loop-build -> /loop-retro in one run. The planner drafts plan.md + acceptance.md with a committee-voted grill (human only on a split), the build agent implements them behind the acceptance-gate-before-review rule, and the retro mines the session + subagent transcripts for ways to improve the kit capabilities that ran. Use when the user says \"/full-loop-semiauto\", or wants a plan-to-build-to-retro pass with as little human interaction as the decisions allow."
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
