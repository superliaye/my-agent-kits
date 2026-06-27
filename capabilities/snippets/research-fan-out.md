## Phase 1 — Research (resident-driven fan-out)

Build a grounded research brief **before** any grilling — you drive the fan-out yourself.

1. **Fan out parallel research sub-agents** over the codebase and the web, in one message
   (multiple `Agent` calls so they run concurrently). Split the problem area into
   independent slices — e.g. "how does X work today (code, at `file:line`)", "what
   constraints/contracts touch this", "prior art / similar features in the repo". Each
   sub-agent returns a focused finding, not a file dump. For any claim the plan's scope
   hinges on (e.g. "this part is already built", "this endpoint exists"), the agent
   **verifies it against live source at HEAD** and returns the `file:line` + the verbatim
   line it saw, marked `[verified@HEAD]` — so you trust a verified claim instead of
   re-reading the same files, and re-check only an unmarked one. This includes claims about
   **runtime behavior** — what a command seeds/writes/reads, what persists across restart,
   what a gate enforces: verify these against source too, never against an ADR or doc alone,
   since an ADR records a decision and can drift from the code that runs.
2. **Invoke the `deep-research` skill** only for **time-sensitive facts** worth a deeper
   dig (a library's current status, a recently-changed API, a version question) — not for
   stable knowledge. Cite URLs for anything from the web.
3. **Synthesise a brief** with these sections:
   - **Problem restated** — the change, in your words.
   - **Problem-area map** — the relevant code at `file:line`, how it works today, and the
     precise call sites the change will touch (with the tests that lock them) where the
     research already reveals them.
   - **Constraints / risks** — contracts, invariants, things that must not break.
   - **Cited web facts** — only the time-sensitive ones, each with a URL.
   - **Open questions** — what the grill must resolve. These seed Phase 2.

The brief is the input to the grill; keep it grounded (every "how it works today" claim
points at a `file:line`), not speculative.
