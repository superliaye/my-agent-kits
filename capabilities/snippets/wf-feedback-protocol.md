## Feedback protocol (shared `@wf`)

Every `@wf` skill separates three kinds of output and never conflates them:

- **task** — the deliverable for this request (the skill's run-dir artifacts).
- **harness** — proposals to improve the repo's guardrails (`CLAUDE.md` at any layer, ADRs,
  `CONTEXT.md`, tastes) so a future run auto-resolves what this one couldn't.
- **skill** — proposals to improve this `@wf` skill itself.

Rules:

- Feedback is a **proposal, never auto-applied**. Nothing edits `CLAUDE.md`, an ADR, or a skill
  on its own.
- Write each item to the run dir **and** append it to the durable backlog:
  `~/.wf/<repo>/feedback/harness/` or `~/.wf/<repo>/feedback/skill/<skill>/`.
- Item format: `kind` (gap | stale | ambiguous), `trigger` (the decision/question that exposed
  it), `why` (harness silent / wrong / vague), `suggestion` (a concrete rule, ADR, or CONTEXT
  term), `runId`.
- Surface an end-of-run feedback digest; the human triages and promotes.
