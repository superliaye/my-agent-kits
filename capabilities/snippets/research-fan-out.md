## Phase 1 — Research (resident-driven fan-out)

Build a grounded research brief **before** any grilling — you drive the fan-out yourself.

1. **Fan out parallel research sub-agents** over the codebase and the web, in one message
   (multiple `Agent` calls so they run concurrently). Split the problem area into
   independent slices — e.g. "how does X work today (code, at `file:line`)", "what
   constraints/contracts touch this", "prior art / similar features in the repo". Each
   sub-agent returns a focused finding, not a file dump.
2. **Invoke the `deep-research` skill** only for **time-sensitive facts** worth a deeper
   dig (a library's current status, a recently-changed API, a version question) — not for
   stable knowledge. Cite URLs for anything from the web.
3. **Synthesise a brief** with these sections:
   - **Problem restated** — the change, in your words.
   - **Problem-area map** — the relevant code at `file:line`, and how it works today.
   - **Constraints / risks** — contracts, invariants, things that must not break.
   - **Cited web facts** — only the time-sensitive ones, each with a URL.
   - **Open questions** — what the grill must resolve. These seed Phase 2.

The brief is the input to the grill; keep it grounded (every "how it works today" claim
points at a `file:line`), not speculative.
