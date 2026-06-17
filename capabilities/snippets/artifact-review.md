## Phase 4 — Artifact review (the three lenses, on the artifacts)

Before stopping, have the committee review the **artifacts you drafted** (`plan.md` +
`acceptance.md`) — not code. This catches a weak plan or unverifiable acceptance criteria
*before* `/loop-build` spends a build on them.

1. **Spawn the three review agents at once** (one message, three `Agent` calls —
   `architecture-review`, `rules-enforcer`, `general-review`), each handed the drafted
   `plan.md` + `acceptance.md` (and the research brief for context) to review. Each applies
   its own lens and returns findings on its own contract.
   If a `subagent_type` is missing, stop and tell the user which reviewer is uninstalled;
   don't run a partial committee.

2. **Judge each finding yourself** (you are the resident — no separate verifier). Apply the
   ones you accept by **revising the artifacts**; this is bounded to **~2 review rounds** —
   re-review only when a revision could have introduced a new issue, not reflexively.

3. **Surface every dismissal.** For each finding you decline, record it with a one-line
   rationale and show it to the user — they may override your judgment. Never bury a
   dismissed finding.
