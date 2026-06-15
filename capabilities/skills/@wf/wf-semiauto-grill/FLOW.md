# wf-semiauto-grill — control flow

## Outer pipeline (main agent + Workflow segments)

Before the script runs, the launcher ensures a `brief.md` exists — reuse an existing one,
optionally run `wf-research`, or write a `/handoff` brief from session context. Then it
launches the grill Workflow and relaunches it once per human pause.

```mermaid
stateDiagram-v2
    direction TB

    state "brief.md available?" as has_brief
    state "use existing brief.md" as existing
    state "run wf-research (optional)" as research
    state "write /handoff brief from session" as handoff
    state "launch grill Workflow" as launch
    state "grill segment" as segment
    state "ask user (main agent)" as ask
    state "relaunch (same runDir)" as relaunch
    state "done: grill.md + feedback" as done

    [*] --> has_brief
    has_brief --> existing: yes
    has_brief --> research: no, want deep research
    has_brief --> handoff: no, session is enough
    existing --> launch: briefPath
    research --> launch: briefPath
    handoff --> launch: briefPath
    launch --> segment
    segment --> ask: needs-human
    ask --> relaunch: answer written
    relaunch --> segment
    segment --> done: questioner exhausted
    done --> [*]
```

Any segment may also end `aborted` (no brief / no run dir) or `degraded` (an artifact write hit
its retry cap); a finished run is `grill-degraded` instead of `done` if the digest write was
capped.

## Grill segment (inside the Workflow script)

One segment auto-resolves a chain of questions and stops at the first genuine decision.

```mermaid
stateDiagram-v2
    direction TB

    state "questioner leaf (naive)" as q
    state "voter panel: 3 voters -> {verdict, citation?, human-call?}" as panel
    state "classify (script)" as gate
    state "write qa/NNN (enforced)" as write
    state "finalize: assemble grill.md" as finalize
    state "end: needs-human (+ harness-gap note)" as needs

    [*] --> q
    q --> finalize: tree exhausted
    q --> panel: next question
    panel --> gate
    gate --> write: converge + cited rule (grounded)
    gate --> write: converge, no rule (assumed + flag)
    write --> q
    gate --> needs: split, or panel flags a human call
    needs --> [*]
    finalize --> [*]
```

Convergence auto-answers either way — *grounded* (a cited harness rule) or *assumed* (a
conventional default, flagged in the digest and emitted as harness-gap feedback). The human is
pulled in only for a genuine decision: the panel splits, or flags the question as a human call.

## enforced() — per-artifact loop

Reuses the `wf-research` enforcement loop: a worker writes an artifact, a separate checker
leaf reads it back from disk, the script gates pass / re-dispatch / degrade. No later leaf
reads an unverified artifact — here, the checker also enforces that each `qa/NNN` entry
carries enough (question, resolution, cited rule or escalation reason, provenance) for a cold
questioner to continue.

```mermaid
stateDiagram-v2
    direction LR

    state "Dispatch" as Dispatch
    state "Check" as Check
    state "Pass" as Pass
    state "Degraded" as Degraded

    [*] --> Dispatch
    Dispatch --> Check: worker wrote
    Check --> Pass: valid
    Check --> Dispatch: invalid, retry
    Check --> Degraded: invalid, capped
    Pass --> [*]
    Degraded --> [*]
```
