---
description: Get structured feedback on how a product is used — task flows, friction, first-time comprehension, the job it does, value delivery, error recovery, information architecture. Trigger with "critique this flow", "is this usable?", "where will users get stuck?", or when sharing a feature/flow for a usability read.
argument-hint: "<flow, feature, or reachable UI>"
allowed-tools: Agent
added_in: 0.37.0
---

# /product-critique

Critique a product on the **usability** axis — how people use it. This is a thin launcher over the
`product-critic` agent: resolve its inputs, spawn it, relay its findings — the agent owns the lens
and the flow-walking, so don't re-derive them here. (For the **visual** axis — how it looks — use
`/design-critique`; for both at once, `/critique-committee`.)

## Do this

1. **Resolve the inputs** — ask the user only for what's genuinely missing:
   - **Target** — the flow / feature / screen to critique.
   - **Context** — who the user is and the job they're trying to do.
   - **How to reach the UI** — the route/state and how to launch it. The agent critiques the
     *running* product, so this is what it needs; if nothing runs, it will say what it needs rather
     than guess — surface that to the user.

2. **Spawn the agent**, foreground:
   ```
   Agent({
     subagent_type: "product-critic",
     description: "product-critique <target>",
     prompt: `
       TARGET: <flow / feature / screen>
       CONTEXT: <who the user is, the job they're trying to do>
       HOW TO REACH THE UI: <route / launch command>
     `
   })
   ```

3. **Relay its findings** — grouped as the agent returned them, each with its user-impact line. An
   empty findings array is a valid result.

If `product-critic` isn't installed, say so and stop — don't critique inline; the lens and walk
mechanics live in the agent.
