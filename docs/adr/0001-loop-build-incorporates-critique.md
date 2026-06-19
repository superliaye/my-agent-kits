# loop-build incorporates critique findings directly, gated by acceptance

Status: accepted (implementation deferred)

After a UI build passes its acceptance gate, the `loop-build` build agent runs the design and
product critics and **incorporates their findings directly** — judging and applying them in the
same step it already uses for the review committee — rather than only surfacing them for the human
to act on later. We chose direct incorporation so a build doesn't ship a needlessly worse product
just because the plan never spelled out an empty state or a clear primary action.

## Scope guard (why this doesn't break "build the plan, not your own idea")

This sits in deliberate tension with the build agent's contract. The line that resolves it:

- The agent **applies** critique findings that improve the built increment **within the plan's
  intent** — polish, obvious usability fixes, missing empty/error/loading states the plan implied.
- A finding that needs **new scope or a product decision the plan didn't make** is **escalated**,
  not silently built — the same escalation path used for an ambiguous requirement. The agent still
  does not redesign on its own initiative.

## Consequences

- Critique runs **only after acceptance passes** (never critique a half-built experience) and is
  bounded by the acceptance round cap; a critique-driven change that could regress acceptance
  re-runs acceptance.
- It runs only when there is a reachable UI to critique — which a UI build already has, since the
  visual-acceptance step drove the feedback loop; reuse that running UI rather than relaunch.
- Applied and declined critique findings are reported in the build summary like committee feedback,
  so the human still sees what the agent changed and what it chose not to.

## Considered and rejected

**Advisory-only** (surface critique findings, leave the human to act) was the earlier decision. It
was rejected because it leaves obvious, in-scope improvements unmade and pushes routine polish onto
the human. This ADR supersedes that stance.
