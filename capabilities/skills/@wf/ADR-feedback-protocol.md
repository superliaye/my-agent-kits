---
status: accepted
---

# @wf skills separate task output from harness and skill feedback, written to a durable cross-run backlog

Every `@wf` skill emits up to three distinct kinds of output, and they must not be conflated:
**task output** (the deliverable for this request), **harness feedback** (proposals to improve
the repo's guardrails so future runs auto-resolve what this one couldn't), and **skill
feedback** (proposals to improve the `@wf` skill itself). Feedback is captured in a fixed
format, appended to a durable per-repo backlog under `~/.wf/<repo>/feedback/`, and is always a
proposal — never auto-applied.

## Why

- **Feedback is a first-class output, not a side note.** A semi-automated loop's value
  compounds only if the gaps it finds flow back into the harness. When a grill escalates a
  question because no rule decided it, it has discovered a missing guardrail; that discovery
  is worth as much as the answer. Burying it in a per-run task artifact loses it.
- **Operational decisions and improvement proposals are different things.** A single
  escalation co-emits both — the human's answer is task output; the "no rule decided this"
  note is harness feedback. They go to different channels, in different formats, so the
  maintainer can triage feedback without digging through task artifacts.
- **Durable and cross-run, so patterns surface.** The same gap hit across five runs (or across
  `wf-research` and `wf-semiauto-grill`) only reads as a pattern if feedback accumulates in
  one place. The backlog lives under `~/.wf/<repo>/feedback/`, out of git until a human
  promotes it.
- **Proposals only, traceable to the run.** This is the existing `@wf` "ratchet on failure…
  traceable to the run that caused it," made concrete. Nothing edits `CLAUDE.md`, an ADR, or a
  skill automatically.

## Shape

- Defined once as the `wf-feedback-protocol` snippet and `<!-- include: -->`'d into each `@wf`
  skill, so the deployed skills stay self-contained.
- Channels and locations:
  - **task** → the run dir (skill-specific; e.g. the grill's per-Q&A files + `grill.md`).
  - **harness** → `~/.wf/<repo>/feedback/harness/` (append), plus a per-run copy.
  - **skill** → `~/.wf/<repo>/feedback/skill/<skill>/` (append), plus a per-run copy.
- Item format: `{ kind: gap | stale | ambiguous, trigger (the decision/question that exposed
  it), why (harness silent / wrong / vague), suggestion (a concrete rule, ADR, or CONTEXT
  term), runId }`.
- The main agent surfaces an end-of-run feedback digest; the human triages and promotes.

## Considered and rejected

- **Per-run feedback only, surfaced then discarded.** Simplest, but nothing accumulates — the
  same gap is re-discovered every run, which is precisely the maturation the protocol exists
  to enable.
- **Proposed in-repo diffs (loop-retro style).** Most immediately actionable, but couples each
  skill to the harness file layout and an unaggregated stream of diffs is noisier than a
  triageable backlog. Can be layered on top of the backlog on demand.

## Consequences

- Each `@wf` skill must route its outputs through the three channels and include the snippet;
  a skill that writes feedback inline into task artifacts violates the protocol.
- The backlog is durable state under `~/.wf/<repo>/` that no command prunes automatically;
  triage and promotion are human actions.
- `AGENTS.md`'s "Ratchet on failure" line is now backed by this concrete channel; the
  authoring of the `wf-feedback-protocol` snippet is the implementation that follows.
