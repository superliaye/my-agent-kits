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

1. **Resolve and verify the target once** — the UI / flow to critique, who it's for, and **how to
   reach the UI**: the route/state and the launch command for the surface the app ships as, plus a
   screenshot for the visual lens if you already hold one. Verify the entry point loads real,
   authenticated data before you spawn, so each critic judges the running product rather than a
   blank shell. If you can't reach or authenticate it unattended, that's a loop-readiness gap —
   surface it (the `loop-check-readiness` audit diagnoses these) and stop. Resolve this once, then
   hand the same launch info to both critics and let each route to its own surface.

2. **Spawn both at once** (one message, two Agent calls), foreground. **Each critic owns its own
   capture and flow** — the looks lens and the use lens deliberately look at different aspects, so
   let each grab the screens or walk the steps *it* needs rather than sharing one capture:
   - `subagent_type: design-critic` — the visual lens; give it the target + how to reach the UI
     (or a screenshot, if you already have one for it to judge).
   - `subagent_type: product-critic` — the usability lens; give it the target + how to reach the UI.

   When a UI is reachable and both will drive it, each critic captures independently — keep the two
   captures from colliding (each critic isolates its own session; the visual-loop skill owns the
   mechanism). This assumes the app can serve two drivers at once; if it can't without collision,
   surface that as a loop-readiness gap.

3. **Report, grouped by lens.** Present design-critic's findings and product-critic's findings
   separately — do not merge or rerank across the two. An empty findings array from either lens is a
   valid result; report it as such.

Before spawning, check both `subagent_type`s resolve. If either is missing, stop before spawning
any agent and name the missing one — don't run a partial committee silently.
