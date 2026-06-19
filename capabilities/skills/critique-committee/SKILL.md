---
description: Critique a UI on both axes at once — a committee of the design-critic (how it looks) and the product-critic (how it's used) run in parallel, with findings presented grouped by lens. Use for "critique committee", "full critique", "review this design and its usability", when both critic agents are installed.
argument-hint: "<target UI / flow / screenshot>"
added_in: 0.37.0
---

# /critique-committee

Run both critics on one target **in parallel**, then present their findings grouped by lens. The
agents carry the critique criteria — your job is orchestration and presentation, so keep your own
instructions minimal. The two axes — looks (design-critic) and use (product-critic) — stay
**separate**; do not merge or rerank across them.

## Steps

1. **Resolve the target once** — the UI / flow to critique, who it's for, and **how to reach the
   UI** (route/state + launch command, plus a screenshot for the visual lens if you already hold
   one). Both critics work from the running product — if nothing is reachable, they will say what
   they need rather than guess, so surface that. You resolve this once and hand the same reach info
   to both critics.

2. **Spawn both at once** (one message, two Agent calls), foreground. **Each critic owns its own
   capture and flow** — the looks lens and the use lens deliberately look at different aspects, so
   let each grab the screens or walk the steps *it* needs rather than sharing one capture:
   - `subagent_type: design-critic` — the visual lens; give it the target + how to reach the UI
     (or a screenshot, if you already have one for it to judge).
   - `subagent_type: product-critic` — the usability lens; give it the target + how to reach the UI.

   When a UI is reachable and both will drive it, hand each a **distinct debugging port +
   user-data-dir** so their independent captures don't collide on one browser session.

3. **Report, grouped by lens.** Present design-critic's findings and product-critic's findings
   separately — do not merge or rerank across the two. An empty findings array from either lens is a
   valid result; report it as such.

Before spawning, check both `subagent_type`s resolve. If either is missing, stop before spawning
any agent and name the missing one — don't run a partial committee silently.
