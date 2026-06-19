# loop-plan research conditionally critiques the existing product

Status: accepted (implementation deferred)

When a plan targets an **existing, reachable product/UI**, `loop-plan`'s Phase-1 research fan-out
also spawns the design and/or product critics as research leaves, folding "how it looks and how
it's used today" into the grounded brief. A plan to improve an existing product is better grounded
in its current experience than in code-reading alone.

## Consequences

- **Conditional.** Skipped for greenfield or non-UI work, and skipped when no UI is reachable
  (the critics judge what renders/runs, so they have nothing to read otherwise).
- **One wiring point.** The conditional spawn lives in the shared `research-fan-out` snippet, so a
  single edit wires both `/loop-plan-manual` and `/loop-plan-semiauto`.
- The critics' findings feed the brief's problem-area map and open questions — context for the
  grill and the draft — not the plan items directly.
- Which lens fires (design, product, or both) follows whether the change is visual.
