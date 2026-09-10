---
name: grill-with-committee
description: "A semi-automated grilling session: /grilling forms each decision frontier, a three-lens committee resolves answers when unanimous, and /domain-modeling captures glossary and ADR effects. Any split or \"Other\" vote escalates to the human. Standalone it writes a per-run grill.md digest with committee or human provenance. Use for a minimal-human stress test or as /loop-plan-semiauto's grill phase."
added_in: 0.33.0
---

# /grill-with-committee

Call the Skill tool with `grilling`, passing the current decision context. Substitute committee
voting for its answer slots: unanimous enumerated answers are accepted silently; a split or
any "Other" vote escalates to the human.

A unanimous committee answer occupies the user-answer slot that `grilling` normally waits
for. Apply the same consensus rule to its final shared-understanding confirmation, preserving
the no-human path when all three voters agree.

Usable **standalone** (ending in a `grill.md` digest) or **embedded** as the grill phase of
`/loop-plan-semiauto`. You drive every round; only **you** talk to the user — the voters are
autonomous leaves that only vote.

When embedded, accept only the planner's **release decisions** as the frontier. An explicitly
deferred implementation hypothesis is already resolved for planning purposes. A unanimous vote
settles the decision and its provenance; committee agreement alone never creates acceptance
authority.

## The round loop

Repeat until nothing is open:

1. **Form the frontier with `grilling`.** Pass it the current decision context. Do not vote on
   facts.
2. **Make the answers votable.** For each frontier question, frame 2–4 mutually exclusive
   options plus an "Other" hatch. Give each option a short `id` and name your recommendation.
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
5. **Model + continue.** Call the Skill tool with `domain-modeling`, passing the resolved terms
   and decisions, then feed the answers back into `grilling`. Continue until `grilling`
   reaches its completion condition.

## Standalone output — `grill.md`

Standalone, write a `grill.md` digest to a **per-run folder** `~/.grill/<repo-key>/<run-key>/`
(host-neutral; mint `<run-key>` from the topic and disambiguate if it exists, so concurrent
grills don't collide), and print the path. Each entry: the resolved question, its answer, and
its **provenance** (`committee` = unanimous, `human` = escalated). Embedded in
`/loop-plan-semiauto`, skip the file — the decisions feed the host's draft phase under the
host's run folder.

`CONTEXT.md` / ADR updates from `domain-modeling` are **not** per-run — they're the repo's
durable docs in the working tree, intentionally shared.

## Vote contract

Paste this into each agent's spawn prompt (step 3) — it's the choice shape they return.

<!-- include: committee-answer-contract -->
