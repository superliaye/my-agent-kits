# loop-build — flow diagram

**The resident settles *what ready means*; the build agent owns the loop.** This is
a thin resident-facing entry over two nested agents — it is **not** a segment of the
`loop-swe.js` engine. The resident agent picks the entry mode (artifacts already
exist, or it drafts them cold), confirms the work is ready, and spawns the build
agent foreground. From there the build agent runs the loop on its own behind one
hard rule — **acceptance gates review, always** — and only the few decisions a human
owns come back up: a genuine gap before the build, an escalation at the round cap.
Roles are colored: the resident (blue) brokers and never builds; the build agent
(lavender) implements and orchestrates; the acceptance agent (green) verifies and
never fixes; the three reviewers (purple) run in parallel.

```mermaid
flowchart TD
    You([" You — main chat<br/>/loop-build, answer gates "]):::main --> Gate

    subgraph RES ["resident agent — brokers, never builds"]
      direction TB
      Gate{"readiness gate:<br/>entry mode?"}
      Gate -->|"A · artifacts exist<br/>(prior plan/QA)"| Confirm["confirm plan +<br/>acceptance are current"]:::resident
      Gate -->|"B · invoked cold"| Draft["draft plan +<br/>acceptance from context"]:::resident
      Gate -.->|"cannot assemble<br/>a plan"| NoPlan[["STOP ·<br/>nothing to build"]]:::stop
      Draft --> Gaps{"genuine gaps?"}
      Gaps -->|"yes · ambiguous req,<br/>missing threshold,<br/>irreversible choice"| AskU[["AskUserQuestion<br/>then get the nod"]]:::pause
      Confirm --> Spawn
      AskU --> Spawn
      Gaps -->|"no · get the<br/>user's nod"| Spawn
      Spawn["spawn build agent (foreground):<br/>PLAN, ACCEPTANCE,<br/>REVIEW FIXED-POINT, ROUND CAP"]:::resident
    end

    Spawn --> Impl

    subgraph BUILD ["build agent — owns the loop · implement first, gate, then review"]
      direction TB
      Impl["implement plan as-is<br/>commit coherent slices"]:::agent --> Acc
      Acc["spawn acceptance agent"]:::agent
      Acc -.->|"spawns"| AccA["acceptance: verify each<br/>criterion, never fixes"]:::accept
      AccA --> Split{"acceptance<br/>result?"}
      Split -->|"some fail · rounds left<br/>(fix from not-working[])"| Impl
      Split -->|"cap hit · still failing<br/>(incl. no-harness)"| Esc
      Split -->|"all pass"| Review
      Split -->|"nothing-to-verify<br/>(both blocks empty)"| Review
      Review["/loop-review-committee —<br/>non-interactive, vs fixed-point"]:::agent --> Fan
      Fan>"fan out 3 reviewers<br/>in parallel"]:::agent
      Fan --> Ra["architecture-<br/>review"]:::review
      Fan --> Re["rules-<br/>enforcer"]:::review
      Fan --> Rg["general-<br/>review"]:::review
      Ra --> Judge
      Re --> Judge
      Rg --> Judge
      Judge["judge each finding self ·<br/>apply + commit, or<br/>decline → dismissed-feedback"]:::agent --> Regress{"a fix could<br/>regress acceptance?"}
      Regress -->|"yes · re-run"| Acc
      Regress -->|no| Ret
      Ret["return structured summary:<br/>executed · achieved · still-missing<br/>dismissed-feedback · harness-improvements"]:::agent
    end

    Esc[["escalate: failing criteria<br/>+ what tried + recommendation"]]:::stop --> Broker
    Broker["resident brokers: AskUserQuestion<br/>→ re-spawn with resolutions<br/>+ note of what landed"]:::resident
    Broker -.->|"resume · continues,<br/>does not restart"| Impl

    Ret --> Relay["resident relays the<br/>structured summary"]:::resident
    Relay --> Done([" Done — built, accepted,<br/>reviewed, summarized "]):::done

    classDef main fill:#d6e4ff,stroke:#1f5fbf,color:#111;
    classDef resident fill:#dbeafe,stroke:#2563eb,color:#111;
    classDef agent fill:#eef0ff,stroke:#5b5bd6,color:#111;
    classDef accept fill:#e3f6e3,stroke:#27ae60,color:#111;
    classDef review fill:#f3e8ff,stroke:#8b5cf6,color:#111;
    classDef pause fill:#fff3d6,stroke:#c08a00,color:#111;
    classDef stop fill:#fde2e2,stroke:#c0392b,color:#111;
    classDef done fill:#e3f6e3,stroke:#27ae60,color:#111;
```

## The two entry modes

The readiness gate is the resident's only real fork. **Mode A** — a prior
research/plan session (e.g. [`/loop-research-plan`](../loop-research-plan/SKILL.md))
already produced the plan and the acceptance doc; the resident confirms both are
current and spawns with **no user interaction**. **Mode B** — invoked cold; the
resident drafts the plan + acceptance from session context, then uses
`AskUserQuestion` **only** for genuine gaps (an ambiguous requirement, a missing
threshold, an irreversible choice) and otherwise gets the user's nod and spawns.
If it cannot assemble a plan at all, it **stops** rather than spawn a build with
nothing to build.

## Acceptance gates review — always

Inside the build agent, the hard rule is the order: **implement → acceptance →
review**, never review first. The acceptance agent verifies each criterion with
evidence and **never fixes** (it spawns nothing). Its result fans into four:

- **all pass** or **nothing-to-verify** (both criteria blocks empty) → proceed to
  review.
- **some fail, rounds left** → fix from the `not-working[]` evidence and loop back
  to implement.
- **cap hit, still failing** (including a `no-harness` criterion with no runnable
  signal) → **escalate**, do not proceed to review.

Only past that gate does the review committee run: `/loop-review-committee`
non-interactively against the review fixed-point, fanning out
**architecture-review**, **rules-enforcer**, and **general-review** in parallel.
The build agent judges each finding itself — applies and commits the ones it
accepts, records the rest with a rationale for `dismissed-feedback` — and if a fix
could regress acceptance, **re-runs acceptance** before returning.

## Escalation is brokered, then resumed

When the build agent stops at the round cap (or hits a blocker it can't act on), it
returns an explicit escalation — the failing criterion, what it tried, its
recommendation. The resident brokers that with `AskUserQuestion` and **re-spawns**
the build agent with the resolutions folded in and a note of what already landed, so
the build **continues rather than restarts**. The resident relays the final
structured summary the build agent returns: `executed`, `achieved`, `still-missing`,
`dismissed-feedback`, `harness-improvements`.
