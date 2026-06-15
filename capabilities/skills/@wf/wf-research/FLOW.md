# wf-research — control flow

## Phase pipeline (outer state machine)

```mermaid
stateDiagram-v2
    direction TB

    state "setup-root-dir" as setup_root_dir
    state "research" as research
    state "fan-out web" as fanout
    state "continue" as continue
    state "done" as done
    state "brief-degraded" as brief_degraded
    state "research-failed" as research_failed

    [*] --> setup_root_dir
    setup_root_dir --> research

    research --> research_failed: degraded
    research --> done: no heavy needs
    research --> fanout: heavy needs

    fanout --> continue: web written

    continue --> done: ok
    continue --> brief_degraded: degraded

    done --> [*]
    research_failed --> [*]
    brief_degraded --> [*]
```

## Web tiers (where T0/T1/T2/T3 run)

T0/T1 are decided and executed inside `research` (per fact); only an escalated fact
crosses into the fan-out, which runs only T2/T3.

```mermaid
stateDiagram-v2
    direction LR

    state "research" as research
    state "fan-out" as fanout
    state "resolved" as resolved

    [*] --> research
    research --> resolved: T0 skip
    research --> resolved: T1 inline (in brief)
    research --> fanout: escalate (heavy need)
    fanout --> resolved: T2 (t2.md)
    fanout --> resolved: T3 (t3.md)
    resolved --> [*]
```

## enforced() — per-artifact loop (inner state machine)

A crashed worker (returns nothing) retries, or degrades at the cap, the same way — but
skips the Check.

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
