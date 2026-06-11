# loop-swe engine: keep the human *on* the loop, not *in* it

Status: accepted

## Context & philosophy

Repetitive engineering work — scope, plan, implement, review, verify, reflect —
has enough recurring shape to be encoded **once** as a disciplined harness rather
than re-driven by hand on every task. That is the bet this engine makes, and it
is the bet the industry is converging on: build skills for the processes that
recur, then run them as a *loop* the agent can carry on its own.

The design goal is one sentence: **make autonomous work trustworthy enough that a
human can stay *on* the loop instead of *in* it.** In the loop means prompting
every step and reviewing every diff. On the loop means the agent does the work
behind guardrails — with high-quality, evidence-backed understanding — and only
interrupts you for the few decisions a human actually owns. The decision below is
how the engine earns that trust. Context isolation, often cited as "the point,"
is just one of the guardrails; the point is the trust the guardrails buy.

## Decisions

1. **Autonomous by default; pause only on a genuine decision.** A self-digest
   agent splits every open question into auto-resolved vs needs-human. The run
   returns a `gate` only when something truly needs you. Before anything is
   flagged, escalation discipline makes the agent check `CLAUDE.md`, `CONTEXT.md`,
   `docs/adr/`, and prior run artifacts — so the human sees decisions, not
   lookups. This is the mechanism that keeps you *on* the loop.
