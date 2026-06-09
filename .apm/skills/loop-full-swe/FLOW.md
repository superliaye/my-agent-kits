# loop-full-swe — flow diagram

Human-facing reference for the [`loop-swe.js`](loop-swe.js) engine. Not loaded by
the agent (the skill loader only reads [`SKILL.md`](SKILL.md)); kept here so the
diagram never costs run-time context.

**Context management is the whole point.** Each shaded box is a separate
**sub-agent** with its own fresh context window — it does one job and returns a
short structured result. Your main chat never sees a sub-agent's internal work,
only its compact result and the gate summaries. Diamonds are cheap script
branches (no context cost); pale notes are what a phase decides or produces.

```mermaid
flowchart TD
    Main([" You — main chat<br/>launch + answer gates "]):::main --> Scope

    subgraph P0 ["1 — Scope · read-only research"]
        Scope["survey repo + docs"]:::agent --> TL{"too big for<br/>one run?"}
        Scope -. classifies .-> SF["track: trivial /<br/>standard / architectural<br/>+ UI? + too big?"]:::note
    end
    TL -->|yes| GDist

    subgraph P1 ["2 — Plan · survey-grade research"]
        Plan["map architecture<br/>with file:line proof"]:::agent --> Digest
        Plan -. writes .-> AF["architecture-impact<br/>unless trivial · success<br/>criteria · reversibility"]:::note
        Digest["triage:<br/>self vs human"]:::agent --> NeedH{"need<br/>human?"}
        NeedH -->|no| Bake["fold answers<br/>into plan"]:::agent
    end
    TL -->|no| Plan
    NeedH -->|yes| GPlan

    subgraph P2 ["3 — Build · up to 3 rounds"]
        Impl["implement +<br/>commit"]:::agent --> Val{"runs +<br/>passes?"}
        Val -->|no| Impl
        Val -->|yes| Ra & Rd & Rg & Ro
        Ra["review:<br/>architecture"]:::agent --> Vfy
        Rd["review:<br/>DDD"]:::agent --> Vfy
        Rg["review:<br/>general"]:::agent --> Vfy
        Ro["review:<br/>design — if UI"]:::agent --> Vfy
        Vfy["verify each<br/>finding"]:::agent --> HasH{"need<br/>human?"}
        HasH -->|no| More{"more<br/>fixes?"}
        HasH -->|some| More
        More -->|yes| Impl
    end
    Bake --> Impl
    HasH -->|stuck| GBuild

    subgraph P3 ["4 — Wrap up"]
        Sum["summarize"]:::agent --> Retro["reflect<br/>advice only"]:::agent
    end
    More -->|no| Sum
    Retro --> GDone([" Done —<br/>code committed "]):::done

    GPlan[["PAUSE · Plan"]]:::pause
    GBuild[["PAUSE · Build"]]:::pause
    GDist[["STOP · too large<br/>→ see below"]]:::stop

    GPlan -. "answer → resume<br/>(work cached)" .-> Plan
    GBuild -. "answer → resume" .-> Impl

    classDef main fill:#d6e4ff,stroke:#1f5fbf,color:#111;
    classDef agent fill:#eef0ff,stroke:#5b5bd6,color:#111;
    classDef note fill:#fcfbe6,stroke:#b8a93a,color:#333;
    classDef pause fill:#fff3d6,stroke:#c08a00,color:#111;
    classDef stop fill:#fde2e2,stroke:#c0392b,color:#111;
    classDef done fill:#e3f6e3,stroke:#27ae60,color:#111;
```

Legend: blue = your main chat · indigo = a sub-agent (isolated context) ·
diamond = a script branch · pale note = a decision/output · amber = resumable
pause · red = terminal stop · green = end state.

## Where the research happens

There is no separate "Research" box — research **is** the Scope + Plan phases
(that pairing is exactly what `/loop-research-plan` runs on its own). The early
flow is where the architecture impact gets weighed, and it drives everything
after it:

- **Scope** is a read-only survey of the repo and docs. It classifies the work
  into a **track** by architectural impact — `trivial` (a few files, no
  architectural reach), `standard`, or `architectural` (cross-cutting or a new
  boundary) — and flags whether it **touches UI** and whether it's **too big for
  one run**.
- **Plan** is deliberately more cautious than ordinary plan mode: it maps the
  affected architecture with **file:line evidence**, writes an
  **architecture-impact** analysis (skipped only for `trivial`), gives each work
  item **success criteria**, and tags every open question with its
  **reversibility**.
- Those three factors steer the rest of the flow: `architectural` track → the
  deeper architecture analysis; `UI` → the design reviewer joins the Build
  fan-out; `too big` → the run decomposes instead of building (next section).

## Build, briefly

Build is the working loop: implement → check it runs → review from several angles
**in parallel** → verify each finding against the real diff before it can cost a
rebuild → loop the confirmed fixes back in. Capped at three rounds so it can't
spin forever. The parallel review is the clearest context win: four reviewers run
as four isolated sub-agents at once, none polluting the others' or your context.

## The three stops are not the same

- **PAUSE · Plan** and **PAUSE · Build** are *resumable*. The run hits a question
  it can't answer, returns it to you, and waits. You answer; it resumes the
  **same run** from where it paused — earlier sub-agent work is cached and replays
  instantly.
- **STOP · too large** is *terminal for that run*, and it behaves differently
  enough to deserve its own picture.

## What "too large" does

The work was really several features, so the engine breaks it into sequenced
issues and the run ends. What happens next is **main-chat orchestration**, not a
resume:

```mermaid
flowchart TD
    G[["STOP · too large for one run"]]:::stop --> D{"build them<br/>now?"}
    D -->|"no — default"| File([" file issues via /to-issues<br/>run later, one at a time "]):::done
    D -->|opt-in| Next

    subgraph Chain ["main chat drives — sequential, dependency order"]
        Next["pick next<br/>unchecked issue"] --> Run
        Run[["same engine, this issue<br/>scope → plan → build<br/>no retro"]]:::reuse --> Gate{"its own<br/>plan/build pause?"}
        Gate -->|yes| Ask["you answer →<br/>resume this issue"]:::pause
        Ask --> Run
        Gate -->|"still too big"| Esc[" stop + escalate<br/>no nested split "]:::stop
        Gate -->|committed| Check["tick the box"]
        Check --> More2{"more<br/>issues?"}
        More2 -->|yes| Next
        More2 -->|no| Retro2["one retro for<br/>the whole chain"]:::agent
    end
    Retro2 --> End2([" Done "]):::done

    classDef agent fill:#eef0ff,stroke:#5b5bd6,color:#111;
    classDef reuse fill:#d9f2f0,stroke:#0a8f87,color:#111;
    classDef pause fill:#fff3d6,stroke:#c08a00,color:#111;
    classDef stop fill:#fde2e2,stroke:#c0392b,color:#111;
    classDef done fill:#e3f6e3,stroke:#27ae60,color:#111;
```

So **"new run per issue" = this whole engine, re-invoked once per issue** — but
with `stopAfter: build`, so each issue does Scope → Plan → Build and skips its own
retro. Key points:

- **Sequential, in dependency order.** No parallel runs, no worktrees — issue N+1
  starts only after issue N's commit lands.
- **Your main chat is the manager.** It launches each issue's run, surfaces and
  resumes that issue's own plan/build pauses, ticks the issue off in a progress
  file, then moves on. It is *opt-in*: by default the issues are just filed via
  `/to-issues` for you to run later.
- **One retro at the end** over the whole chain, not per issue.
- **One-level cap.** If an issue is *still* too big, the chain stops and escalates
  to you rather than recursively decomposing.
