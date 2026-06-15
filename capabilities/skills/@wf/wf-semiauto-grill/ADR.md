---
status: accepted
---

# wf-semiauto-grill is a resumable, file-based Workflow that auto-resolves grill questions against the harness and escalates only the residue

wf-semiauto-grill is a capital-W dynamic Workflow that turns a one-shot grill into a
semi-automated loop. It consumes a brief (`brief.md`) — usually from `wf-research`, but any
session-context handoff works, and an existing brief is reused — then asks one
dependency-aware question at a time. A harness-aware voter panel resolves each: when it
converges it auto-answers, recording whether the answer is *grounded* in a cited harness rule
or a *conventional default* it had to assume; it pauses to the human only for a genuine
decision (the panel splits, or flags the question as a human call). It hands off — like every
`@wf` skill — through write-once files on disk; the human round-trip happens by ending the
Workflow and relaunching it.

## Why a Workflow, cold leaves, and end-and-relaunch

- **Grilling's value is the Q&A pairs, not just the final answers.** A *naive* questioner —
  blind to the harness — keeps asking the full set of questions a fresh grill would, even
  ones the harness already answers, because each resolved pair is context the downstream
  plan needs to stop the implementer guessing. A *separate*, harness-aware voter panel
  resolves them. The split is the whole mechanism: knowledge of the answer must not suppress
  the question.
- **"Semiauto" classifies each answer; it does not gate the loop on a citation.** When the
  voter panel converges, the answer is auto-recorded with its provenance: *grounded* if at
  least one voter cites a concrete harness rule (`CLAUDE.md` file:line, an ADR, a CONTEXT
  term), or *assumed* if they agree only on a conventional default with no rule behind it. An
  *assumed* answer does not pause the human — it is written, flagged in the digest, and emitted
  as harness-gap feedback, so the loop keeps moving and the gap is captured rather than
  silently baked. The human is pulled in only for a *genuine decision*: the panel splits, or it
  flags the question as a human / strategic / irreversible call it should not make alone.
  Requiring a citation merely to proceed would stall the loop on every undocumented default —
  which, in a sparse harness, is most questions. The script orchestrates the panel as parallel
  leaves so it sees each `{answer, citation, human-call?}` and classifies deterministically.
- **Cold leaves + a rich disk ledger beat a warm resident agent.** Questions have strong
  dependencies, but a write-once per-Q&A ledger captures every prior answer, cited rule, and
  provenance — enough for a cold questioner to reconstruct the decision-tree state and ask
  the next dependent question. This is the standard `@wf` bet. Cold re-reads are TTL-immune
  and cheap across human-speed pauses; a warm resident agent would re-bill its whole context
  once a pause exceeds the prompt-cache TTL.
- **A Workflow can't prompt the user, so the human round-trip lives between runs.** When a
  question can't be grounded the Workflow ends with a `needs-human` payload; the main agent
  (per the SKILL.md) asks the user and relaunches with the same `runDir`, relaying the answer
  back; the questioner cold-reads the qa ledger from disk and continues from the next question.
  Strong dependencies
  make this clean: a `needs-human` question blocks everything downstream, so it is a natural
  segment boundary.
- **Minimal main-agent context in the common case.** When the harness grounds every answer,
  the entire grill is a single fire-and-forget background run that returns the `grill.md`
  cornerstone; the main agent re-engages only per genuine escalation — exactly where human
  attention belongs.

## Considered and rejected

- **A resident, warm Agent A (Agent tool + `SendMessage`) that holds the grill thread warm
  and spawns nested voter panels.** Feasible since Claude Code v2.1.172 unlocked nested
  subagents (depth ≤ 5). Gives warm dependency-coherence and live user bridging with no
  relaunch. Rejected: it forces the main agent to stay attached even when no human is needed
  (more main context, not less), re-bills A's full context on any human pause past the cache
  TTL, and forfeits the Workflow's journaled resume, killability, and progress tree — while
  its one advantage, warm coherence, is recoverable from a rich disk ledger. Nesting is
  therefore available headroom, not a dependency.
- **A live foreground grill loop driven by the main agent (no Workflow).** Closest to
  `/grill-me`, but the main agent babysits every auto-decision and accumulates the entire
  transcript, defeating the minimal-context goal, and it is not a reusable, parameterized
  primitive.
- **A single decider, or a vote-only gate.** Cheaper, but a single model's self-confidence is
  poorly calibrated and bare agreement measures consensus, not groundedness — both let
  confident-wrong answers through.
- **A batched human gate** (collect all unresolved questions, ask once). Impossible here:
  strong dependencies mean Q(n+1) cannot be formed before Q(n) is answered, so there is
  nothing to batch.
- **Hard-coupling to `wf-research` (run it nested, or require its brief).** Rejected on two
  grounds. Mechanically, `wf-research` already nests `deep-research` and Workflow nesting is
  one level only, so it cannot run nested anyway. By design, the grill needs only *a* brief,
  not specifically a research brief: an existing `brief.md`, or a `/handoff` the launcher
  writes from session context, is enough. So `wf-research` is one optional source the main
  agent may run first, not a prerequisite; the Workflow consumes whatever `briefPath` it is
  given.

## Consequences

- The launcher (SKILL.md) ensures a `brief.md` exists before the script runs — reuse an
  existing one, optionally run `wf-research`, or write a `/handoff` brief from session context
  — then launches the grill Workflow, asks the user on `needs-human`, and relaunches. The
  script stays pure.
- Convergence without a citation is recorded as an explicit, flagged *assumption* (never a
  silent default) and always emits harness-gap feedback; the human reviews the batch of
  assumptions in the end digest rather than being interrupted per assumption.
- Cold continuation is only as good as the ledger. The per-artifact checker must reject a
  Q&A entry that omits what a cold questioner needs: the question, the resolution, the cited
  rule(s) or the escalation reason, and provenance (auto vs human).
- Termination is questioner-self-judged, with no completeness critic and no hard cap
  (deliberate). In the all-auto headless case this is an unattended, unbounded loop; a
  runaway backstop is recommended but currently declined, and is recorded here as a known
  risk.
- Cross-model voting (Codex / Gemini) is deferred; v1 is a three-Claude panel.
- Output is per-Q&A write-once files plus an assembled `grill.md` cornerstone the plan reads.
  Harness gaps and skill misses are emitted through the shared feedback protocol — see the
  `@wf` feedback-protocol ADR.
