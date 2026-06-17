---
name: grill-with-committee
description: "A semi-automated grilling session built on /grill-with-docs: instead of asking the human every question, it frames a batch of mutually-independent questions with options and lets a three-lens committee (architecture, rules, first-principles) vote — a unanimous enumerated choice is accepted silently, any split or any \"Other\" escalates to the human. Standalone it writes a grill.md digest of resolved decisions, each tagged with its provenance (committee | human). Use when the user wants to stress-test a plan or design with minimal human interaction (\"grill with committee\", \"semiauto grill\"), or as the grill phase embedded inside /loop-plan-semiauto."
added_in: 0.33.0
---

# /grill-with-committee

Run `/grill-with-docs`'s grill, but instead of putting each question to the human, **batch
the independent ones and let the three `@reviews` agents vote from their lenses** — a
unanimous answer is accepted silently; a split or any "Other" escalates to you. "If lucky, no
human."

Usable **standalone** (ending in a `grill.md` digest) or **embedded** as the grill phase of
`/loop-plan-semiauto`. You drive every round; only **you** talk to the user — the voters are
autonomous leaves that only vote.

## The round loop

Repeat until nothing is open:

1. **Batch.** From the open questions, take a set that are **mutually independent** — none
   depends on another's answer; a gated question waits for a later batch. If the codebase
   answers a question, read it instead of voting.
2. **Frame each with options.** 2–4 enumerated options + an "Other" hatch, each with a short
   `id` and your recommended pick — a normal grill question, written down to vote on.
3. **Spawn the three review agents to vote** at once — `subagent_type: architecture-review`,
   `rules-enforcer`, `general-review`. Each already carries its lens; in the spawn prompt tell
   it it's a **committee voter, not a reviewer** — vote on this batch from your lens and return
   a **choice** per the vote contract ([below](#vote-contract)), not findings. Hand it the
   batch (the questions, their options + ids, and the plan/context). If a `subagent_type` is
   missing, stop and tell the user; don't run a partial committee.
4. **Apply consensus** (a plain compare of the three `choice` strings): all three the **same
   enumerated id** → accept, provenance `committee`. Anything else → **escalate** to you with
   the options, the vote breakdown, and each lens's rationale, provenance `human`. An "Other"
   is never an enumerated id, so any "Other" escalates too.
5. **Record + continue.** Update `CONTEXT.md` / offer an ADR per `/grill-with-docs`'s rules,
   then loop with the next batch (including questions now ungated).

## Standalone output — `grill.md`

Standalone, write a `grill.md` digest to a **per-run folder** `~/.grill/<repo-key>/<run-key>/`
(host-neutral; mint `<run-key>` from the topic and disambiguate if it exists, so concurrent
grills don't collide), and print the path. Each entry: the resolved question, its answer, and
its **provenance** (`committee` = unanimous, `human` = escalated). Embedded in
`/loop-plan-semiauto`, skip the file — the decisions feed the host's draft phase under the
host's run folder.

`CONTEXT.md` / ADR updates (step 5) are **not** per-run — they're the repo's durable docs in
the working tree, intentionally shared.

## Vote contract

Paste this into each agent's spawn prompt (step 3) — it's the choice shape they return.

<!-- include: committee-answer-contract -->
