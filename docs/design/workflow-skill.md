# `/workflow` skill — design doc (in flight)

Status: **GRILLING COMPLETE — all phase decisions locked (2026-05-28).**
Next: build skill artifacts (SKILL.md, orchestrator.sh, 11 phase prompt
templates, state-template.md, README.md) + extracted `/e2e-validate`
skill + new `/improve-DDD-architecture` skill scaffold +
`presets/workflow.yaml`. See decision log at bottom for the full
ledger of design decisions.

Origin: handoff at `C:\Users\super\AppData\Local\Temp\handoff-workflow-skill.md`.
Predecessor / counterpart: `/feature-loop` (SKILL.md at
`C:\Users\super\.claude\skills\feature-loop\SKILL.md`, preset at
`presets/feature-loop.yaml`).

---

## North star

A cybernetic, self-improving feature-build loop. State lives on disk
as a tagged work-item queue; the script is dumb dispatch; each phase
is a fresh Sonnet subprocess. Buys:

- **Determinism of progress accounting** — the agent can't lie about
  how far it got; the state file is canonical.
- **Inspectability + human override** — user can edit `.workflow/`
  artifacts with their normal editor between invocations.
- **Substrate for self-improvement** — Phase 11 Reflection mines every
  run for stalls, oscillations, avoidable escalations, token waste,
  missing context, user overrides, and what's working. Proposes
  patches to CLAUDE.md, the workflow skill itself, dependency skills,
  and project docs. User reviews + applies.

Goal: **become user's leverage.** Day 0 the workflow is imperfect; day
N is meaningfully better because the reflection loop has compounded
accepted patches. Each accepted patch makes the next run cheaper, more
accurate, less interruptive.

Adds three primitives the existing `/feature-loop` lacks:

1. **Architecture-aware planning** — Phase 1 thinks like an expert
   architect, not a feature-completion machine. Multi-artifact output:
   research, repo-profile, architecture-impact, plan. Answers "what do
   the changes mean to the existing architecture?" via 3-branch
   decision tree (no impact / doable / requires shift).
2. **Separate-context triage** — Phase 7 sub-agent classifies reviewer
   findings without seeing implementer narratives (sympathy-of-
   implementation immunity). Mirrors Phase 2 Plan Review structurally.
3. **Self-improvement reflection** — Phase 11 always runs, mines six
   signal classes, proposes PR-staged amendments to make the next run
   better.

---

## Locked decisions

### Q1: Net-new skill, not a mode of `/feature-loop` (LOCKED)

**Terminology correction:** earlier drafts called this a "fork."
That's wrong — `/feature-loop` is pure markdown, there's no source code
to fork from. `/workflow` is a **net-new skill** that borrows phase
*names and purposes* from `/feature-loop` but shares zero implementation
(since `/feature-loop` has no implementation to share). The two skills
will be genetically unrelated artifacts that happen to use similar
phase names.

**The two options that were on the table:**

- **(a) Net-new skill:** create `/workflow` at
  `~/.claude/skills/workflow/` (or vendored equivalent) alongside
  `/feature-loop`. Two independent SKILL.md files, users pick which to
  invoke.
- **(b) Mode of existing skill:** modify `/feature-loop`'s SKILL.md.
  Add a flag like `mode: triaged` (default off). When set, the new
  phases activate. When unset, behavior identical to today.

**Decision: (a) — net-new skill.**

**Reason:** the runtime is structurally different.

| | `/feature-loop` (today) | `/workflow` (new) |
|---|---|---|
| Orchestration | Main agent reads SKILL.md and drives | Bash orchestrator drives |
| Loop state | In agent memory | In `.workflow/` on disk |
| Per-phase agent | Sub-agents dispatched from main (depth=1) | Fresh subprocess per phase, no continuity |
| Recovery | Restart conversation | Re-run orchestrator from last unflipped checkbox |
| Skill artifact | Pure markdown SKILL.md | SKILL.md + `orchestrator.sh` + prompt templates |

Forcing both into one SKILL.md as "modes" would mean documenting two
incompatible runtimes under one name — confusing for the agent reading
the skill, and impossible to opt out of mode-checking logic. A new
skill is honest about the divergence.

Given subsequent decisions (multi-artifact Phase 1, filesystem state,
Phase 6.5 documentation), flag-gating would fit worse and worse over
time.

### Q2: Bash orchestrator, 3.2-compatible (LOCKED)

Matches existing kit conventions (`bootstrap.sh`, all `test/cases/*.sh`).
No `declare -A`, no `mapfile` — use case statements or parallel
name-mangled variables. Works on macOS default bash 3.2, Linux native,
Windows via Git Bash / WSL.

**Realistic size:** 150–250 lines, not the handoff's claimed 30. Must
handle: checkbox parsing, per-phase model selection, parallel fan-out at
Phase 4, per-phase retry caps, triage routing, sensible git commit
messages, idempotent restart, SIGINT trap.

### Q-phase3: Phase 3 Design — thin agent + swappable design skill (LOCKED)

User reframe: `/workflow` should not encode design opinions. Design
knowledge lives in other people's skills (`ui-ux-pro-max`,
`frontend-design`, `design-critique`, future ones). Phase 3 is a thin
agent that **composes with** whatever design skill is installed; the
swappable core is a first-class concern.

**Sub-agent role:** orchestration only. Does NOT contain design
opinions itself. Discovers + invokes the installed design skill.

**Tools:** Read, Glob, Grep, Write (artifact only). No nested Task —
the Phase 3 sub-agent IS the design agent for the duration, following
the invoked skill's protocol inline.

**Inputs:**
- Phase 1 artifacts (`repo-profile.md` for existing design conventions,
  `plan.md` for what's being built)
- The currently configured design skill (see Discovery below)
- Any `DESIGN.md` / design tokens / theme files in the repo

**Process:**
1. Discover installed design skill via priority order.
2. Read that skill's SKILL.md to learn its protocol.
3. Follow the protocol inline. The Phase 3 sub-agent IS the design
   agent for the duration.
4. Emit `design-brief.md` per the skill's output spec.
5. If brief contains `- [ ] REVIEW: <design decision>` items,
   orchestrator pauses via universal human resumption mechanism.
   No intermediate Design Review phase.

**Skills available by contract (preset dependency, not runtime
discovery):**

```yaml
# presets/workflow.yaml declares these as hard dependencies:
skills:
  - design-critique           # baseline design critic
plugins:
  - ui-ux-pro-max             # baseline design generator
  - frontend-design           # secondary fallback
```

When `/workflow` is installed via the kit, these come with it.
No runtime discovery. No priority order. No `.workflow/config.yaml`
override for the baseline case.

**Phase 3 sub-agent invokes them via the Skill tool** — the canonical
composition mechanism. The skill content loads into the sub-agent's
context; no nested Task spawn, no SKILL.md-via-Read kludge.

**Swap mechanism for power users:** edit `presets/workflow.yaml`
locally, or fork. That's the right ceiling on flexibility — keep the
common path frictionless, the swap path explicit.

**Launch incantation (what the bash orchestrator runs for Phase 3):**

```bash
claude -p "$(cat .workflow/prompts/phase3.md)" \
  --dangerously-skip-permissions \
  --allowedTools "Read,Glob,Grep,Write,Skill"
```

- `--dangerously-skip-permissions` = `--permission-mode bypassPermissions`.
  Required so phase agents don't block on permission prompts.
- `--allowedTools` whitelists exactly what Phase 3 needs: `Read` for
  Phase 1 artifacts + repo design files, `Glob`/`Grep` for design
  system discovery, `Write` for artifact emission to `.workflow/`,
  `Skill` to invoke the baseline design skills.

**Why no Phase 4 Design Review (asymmetric with Phase 1/2):** Plan
Review existed because the planner is the only one with architectural
judgment — no external skill to defer to. Design is the opposite:
judgment lives in the *invoked design skill*. Adding Phase 4 Design
Review would re-invent what `design-critique` etc. already do. Trade-off
accepted: design briefs from a sloppy skill go uncaught until Phase 7
(post-implementation). Document this in SKILL.md so users know to
install something they trust.

**Output:** `.workflow/design-brief.md` (single artifact, format
determined by the invoked design skill).

### Q-research: Research delegation rule (LOCKED)

Top-level discipline in `/workflow`'s SKILL.md, applies to every phase
(not just Phase 1).

**Trigger** (when to research at all): reuse `core.instructions.md`
"Research current-state claims" criteria. Don't redefine.

**Size classification** (once triggered):

- **SMALL** — single source, no synthesis. One WebSearch, one
  WebFetch, one Read, one Grep, one Glob. Agent does inline. Cite the
  source in the calling artifact.
- **SIZABLE** — multi-source synthesis, topic survey, state-of-art
  evaluation, technology trend assessment, "is X still maintained"
  with uncertain answer. **Agent MUST NOT do inline.** Delegate:
  1. Append to `.workflow/plan.md`:
     `- [ ] Research: <topic> → .workflow/research/<slug>.md`
  2. Spawn sub-agent via Task with: topic, scope, expected artifact
     path, output cap (≤300 words summary + cited URLs).
  3. Sub-agent writes the artifact, flips its own checkbox to `[x]`.
  4. Calling agent reads artifact, resumes work.

  If artifact insufficient: calling agent appends a refined
  `- [ ] Research: <refined topic>` and re-delegates. **No inline
  bailout.**

**Clean classification rule** for edge cases (single page, multi-claim
synthesis): if you'd be tempted to paste several paragraphs of context
into the calling artifact to support a single sentence of conclusion,
it's SIZABLE.

**Sub-agent role purity:** research sub-agents emit research artifacts
ONLY. A sub-agent asked to "research and propose a fix" mixes roles and
muddies discipline. Two separate sub-agents instead.

**Depth implication:** `/feature-loop` locks sub-agent depth = 1. This
rule allows depth = 2 in `/workflow` (orchestrator → phase agent →
research sub-agent). Safe because the state machine bounds it — every
spawned sub-agent corresponds to a checkbox, orchestrator can count.
**Depth = 2 ONLY for research delegation.** No other depth-2 patterns
allowed under this allowance.

**Sync, not async:** phase agent blocks while research sub-agent runs.
Async would require cross-phase dependency tracking — overkill.

**Scope:** this rule lives in `/workflow`'s SKILL.md, not promoted to
`core.instructions.md` yet. The MECHANISM (append checkbox to plan.md)
only works where a state machine exists. Reflection phase can propose
promotion later if it generalizes.

### Q-escalation-discipline: Don't escalate what documentation already answers (LOCKED)

Cross-cutting rule, applies to every phase with an escalation path:
Phase 2 (REVIEW → HUMAN), Phase 3 (REVIEW), Phase 4 (DECISION),
Phase 5 (Unable to Validate), Phase 7 (ASK), and any future addition.

**Before flagging anything for human resolution, the agent must check
existing documentation first:**

- `~/.claude/CLAUDE.md` (global user instructions)
- `<repo>/CLAUDE.md` (project instructions)
- `<repo>/CONTEXT.md` (domain glossary, if present)
- `<repo>/docs/adr/` (architecture decision records, if present)
- `<repo>/docs/` more broadly (DESIGN.md, ARCHITECTURE.md, etc.)
- Phase 1 artifacts (`repo-profile.md`, `architecture-impact.md`,
  `plan.md`, `design-brief.md`) — these are *intra-run* documentation
  the user has effectively endorsed by reaching Phase 7

**Only escalate when the answer is genuinely not present.**

**Why this matters:** the loop's value depends on the user being asked
sparingly and only on novel questions. If a finding flags
"missing-error-handling-violates-CLAUDE.md" and CLAUDE.md explicitly
says "alert on missing error handling," that's not an ASK — that's an
AUTO_APPLY with rule citation. Escalating it wastes the user's
attention and trains them to ignore the loop's prompts.

**Enforcement:** every phase prompt template includes the rule
verbatim, plus a "before escalating, prove the answer isn't in any of
the above documents" checklist. Escalation entries include a brief
"checked against: <docs>; not found" line so the audit is visible.

**Reflection (Phase 11) catches violations.** If reflection sees ASK
items that could have been resolved from CLAUDE.md, it proposes
either (a) a CLAUDE.md sharpening so the next run resolves it
automatically, or (b) a prompt-template tightening so the agent is
better at finding the answer next time.

### Q-state-machine: Work-item queue with tags, not phase enumeration (LOCKED, FOUNDATIONAL)

**The state machine file is a tagged work-item queue, not a "Phase N
is current" pointer.** Each item carries a tag that tells the script
which phase agent handles it. The script's only job is: read state,
find the highest-priority pending actionable item, dispatch the phase
that handles its tag, loop.

**Tags and dispatch table:**

| Tag | Dispatch to |
|---|---|
| `to-plan` | Phase 1 |
| `to-review-plan` | Phase 2 |
| `to-design` | Phase 3 |
| `to-implement` | Phase 4 |
| `code-complete-needs-verification` | Phase 5 |
| `to-code-review` | Phase 6 |
| `to-triage` | Phase 7 |
| `to-design-critique` | Phase 8 |
| (queue empty + nothing escalated) | Phase 9 → 10 → 11 → done |

**Item statuses:** `pending` / `in-progress` / `done` (+ `HUMAN` / `ASK`
/ `DECISION` for escalations — these are non-actionable until user
input arrives via Q-resolution-via-prompt).

**Items reference detailed artifacts.** The state file is an index +
queue. Substantive content (plan steps, design briefs, review findings)
lives in artifact files (`plan.md`, `design-brief.md`,
`review/architecture-review.md`, etc.). State items just say "this
plan-step is to-implement; details at plan.md#step-3."

**Script logic (cybernetic loop):**

```
loop:
  read state file
  actionable = items where status=pending and tag is dispatchable
  if actionable is empty:
    if ASK/HUMAN/DECISION items exist: EXIT (pause for user)
    if all done and Phase 9-11 unrun: dispatch Phase 9 → 10 → 11
    if all done and Phase 11 ran: EXIT (workflow complete)
  next = highest-priority actionable
  dispatch phase agent for next.tag
  phase agent runs subprocess, updates state file, may add new items
  goto loop
```

**Bootstrap:** when `/workflow` is invoked fresh, the script writes a
single `to-plan` item into the state file. Loop picks it up → Phase 1
runs → Phase 1 closes `to-plan` and emits `to-review-plan` items (one
per REVIEW marker). Loop continues.

**Why this reframe matters:** the original "Phase N checkbox" model
forced the orchestrator to know phase sequence and chunk routing. The
tagged-queue model puts dispatch knowledge in **one place** (the tag
table) and makes the loop oblivious to phase semantics. Adding a new
phase later = adding a tag + a row in the dispatch table. The script
doesn't change.

**Inter-phase carry:** every phase sees all artifacts from all earlier
phases. The state file's index makes finding them trivial. Phase 4
reads `plan.md` + `architecture-impact.md` + `design-brief.md` because
those are linked from state. Phase 7 reads everything in the iter-N
review directory + Phase 1 artifacts + CLAUDE.md.

**This reframe supersedes the "Phase N checkbox" framing in earlier
Q-phase4, Q-phase5, Q-phase6 locks.** The substance of those decisions
(tool whitelists, artifact shapes, status enums, no-narrative
discipline) still holds. The mechanism by which "Phase 4 sub-agent
runs after Phase 5 emits failure" is now: Phase 5 writes a new
`to-implement` item tagged for Phase 4. Loop dispatches it.

### Q-pause-discipline: Only the script pauses; pause only when no actionable work remains (LOCKED)

**Phase agents never pause.** They emit items (including ASK / HUMAN /
DECISION items) and exit. The script aggregates state and decides
whether to dispatch the next item or exit-to-pause.

**Pause condition (single rule):** no pending actionable items AND at
least one ASK / HUMAN / DECISION item present.

**Consequence — best effort before pause.** If a phase produces a
mixed batch (e.g., Phase 7 decides 3 of 5 findings AUTO_APPLY,
escalates 2 to ASK), the 3 AUTO_APPLY items become new actionable
`to-implement` items. The script processes them — through whatever
sub-route their tags permit — *before* checking the pause condition.
The user sees agent's best-effort progress, not a mid-flight halt.

**Implications:**
- Phase agents do not need to know "should I pause now?" They emit
  items and exit. Pausing is the script's responsibility.
- Phase prompts must not instruct agents to "stop and wait for the
  user." They must instruct: "emit ASK item for unresolvable
  questions, continue working on resolvable ones."
- The script's dispatch loop naturally implements best-effort because
  it always picks an actionable item over a pause when both are
  available.

### Q-resolution-via-prompt: User resolution arrives as skill invocation prompt args, not via file edits (LOCKED, CORRECTION)

**Earlier draft was wrong.** It assumed user resolution writes to
`open-decisions.md` (either by hand-edit or skill walk-through). The
correct mechanism is simpler:

**The user re-invokes the skill with a free-text prompt that resolves
pending items.**

Example:
```
/workflow point A is ok, ignore. point B should be fixed.
  for point C, use approach X.
```

**Mechanics:**

1. User invokes `/workflow <free-text>` in Claude Code.
2. Skill's front-end detects: state file has ASK/HUMAN/DECISION items
   pending. The free-text is the resolution input.
3. Skill calls the script, passing the free-text as a `--user-prompt`
   arg.
4. Script identifies which phase the pending items belong to (the
   items' source-phase tag).
5. Script dispatches that phase's agent, embedding `--user-prompt`
   content into the phase prompt template alongside its normal inputs.
6. The phase agent re-processes its pending items WITH the user's
   additional context. Closes resolvable ones, may still escalate any
   that the user's input didn't cover (those go back to ASK / HUMAN /
   DECISION, awaiting another `/workflow <more text>` invocation).

**Why this is better than file-edit:**
- No file format for user to learn. They just describe in natural
  language.
- The phase agent already knows how to reason about its escalated
  items; giving it user context as another input is the same shape as
  giving it CLAUDE.md or Phase 1 artifacts.
- No "skill walks user through each item conversationally" mode. The
  user controls how much to address per invocation.
- One canonical resumption mechanism for every phase that escalates
  (Phase 2 REVIEW, Phase 3 design REVIEW, Phase 4 DECISION, Phase 5
  Unable-to-Validate, Phase 7 ASK, Phase 8 design ASK).

**Capture for Phase 11 Reflection:** the script logs each
`--user-prompt` invocation to `.workflow/user-overrides.log`. That log
becomes Phase 11's input. The user need not manually maintain
`user-overrides.md`.

**Hand-edit path still supported.** Power users can edit
`.workflow/state.md` (or whichever file it ends up being) directly
between invocations. The script doesn't care how state changed — it
re-reads on each invocation. This is a corollary of cybernetic state,
not a separate feature.

### Q-iter-n: Iteration semantics in the tagged-queue model (LOCKED)

**Caveman version:** folders save what happened on past tries so an
agent can say "I tried this twice already, give up." When does a new
folder open?

**Rule: every time Phase 4 starts a NEW BATCH of `to-implement` items,
iteration counter goes up.**

- Phase 1's emitted `to-implement` items → batch from Phase 1 → iter-1
- Phase 5 validation failure emits new `to-implement` items → batch
  from Phase 5 → iter-2
- Phase 7 AUTO_APPLY emits new `to-implement` items → batch from Phase
  7 → iter-3
- Phase 8 AUTO_APPLY → batch from Phase 8 → iter-4

**Within one batch**, Phase 4 may run multiple times (one per chunk).
All chunks of the same batch share the same `iter-N/` directory.

**`iter-N/` contents:**

```
.workflow/iter-N/
├── plan-attempt.md          ← Phase 4's reading of plan items for this batch
├── status.md                ← Phase 4 / Phase 5 emissions
├── validation-report.md     ← Phase 5 detailed findings (if Phase 5 ran)
├── review/
│   ├── architecture-review.md
│   ├── ddd-review.md
│   └── general-review.md    ← Phase 6 outputs (if Phase 6 ran)
└── triage.md                ← Phase 7 decisions (if Phase 7 ran)
```

Skip-tagged items (no Phase 5/6/7) leave the corresponding artifact
files missing — that's a feature, not a bug. Agents reading prior
iterations see "iter-3 had no validation-report.md because the items
were skip-tagged" and reason accordingly.

**Self-bail discipline (per Q-no-caps) still holds.** Each phase's
prompt enumerates prior `iter-*/` directories. Phase 4 reads prior
`plan-attempt.md` to judge whether its fix approach already failed.
Phase 5 reads prior `validation-report.md` for the same failure mode.
Phase 7 reads prior `triage.md` to spot recurring findings. Any agent
that recognizes stall appends DECISION + exits.

### Q-incremental-review: Phase 6 re-reviews only the diff since last review, not the whole branch (LOCKED)

When Phase 4 produces new code in iteration N+1 (driven by Phase 5
failure or Phase 7 AUTO_APPLY), Phase 6 must re-review. But re-reviewing
the entire branch wastes tokens — most of it was already reviewed in
iter-N.

**Diff scope rule:** Phase 6 reviewers compute
`git diff <last-review-sha>..HEAD` where `<last-review-sha>` is the
commit SHA reviewed in the prior iteration. Recorded in
`.workflow/iter-N/review/sha.txt` by Phase 6 itself.

**First iteration's last-review-sha is the Phase 4-start sha** (so
Phase 6 reviews everything Phase 4 produced).

**Edge case — Phase 7-driven re-implementations with `no-review-needed`
skip tag:** items don't go through Phase 6 at all, so `last-review-sha`
stays as it was. The next non-skipped Phase 6 invocation will pick up
the unreviewed commits naturally because diff is to HEAD.

### Q-fast-route: Phase 7/8 grant permission; Phase 4 declares skip tags (LOCKED, CORRECTION)

Earlier draft had Phase 7/8 declaring `no-verification-needed` /
`no-review-needed` directly on emitted items. **Wrong.** Phase 7/8
haven't seen the code change yet — they're reasoning from review
findings, not from the actual fix scope. They can't make a neutral
skip-or-not call.

**Correct mechanism:**

1. **Phase 7/8 emit a permission tag** on AUTO_APPLY `to-implement`
   items: `skip-eligible` (the item is small enough in concept that
   Phase 4 *may* declare skip tags after implementing — Phase 7/8's
   judgment is bounded by the review findings shape).

2. **Phase 4 implements the item.** Now it sees the actual code scope.

3. **Phase 4 declares skip tags** on the implemented item iff
   `skip-eligible` is present AND the implementation matches the
   small-scope expectation. Phase 4 may declare:
   - `no-verification-needed` (skips Phase 5 dispatch)
   - `no-review-needed` (skips Phase 6 dispatch)
   - both / neither — Phase 4's call

4. **If Phase 4 finds the implementation larger than expected** (e.g.,
   the "small fix" actually touched 12 files across 3 modules), Phase 4
   does NOT declare skip tags. The item routes through full Phase 5 +
   Phase 6 + Phase 7 normally. Phase 7's `skip-eligible` permission is
   trusted-but-verifiable: granted optimistically, validated by Phase 4.

5. **Phase 1-emitted `to-implement` items NEVER get `skip-eligible`.**
   No matter how small they look, they must go through full validation
   + review on first encounter. Skip tags are exclusively for
   triage-derived or design-critique-derived fix-ups, where prior
   review provides the safety boundary.

**Script enforcement:** the dispatch logic rejects skip tags on items
without a `skip-eligible` permission, and rejects `skip-eligible` from
phases other than 7 and 8. Validation runs on every state-file update.

**Why this preserves safety:** the original Phase 1 work always gets
end-to-end coverage. The fast route applies only to fixes derived from
already-reviewed code, where the reviewer has bounded what counts as
"small." Phase 4 is the final gate because Phase 4 is the only agent
that has seen both the review findings (via plan.md updates) AND the
implemented code.

### Q-phase7: Phase 7 Triage — mirror Phase 2 (LOCKED)

Phase 7 walks each finding across the three Phase 6 review files,
mirroring Phase 2's protocol. Output trichotomy:

| Decision | Mechanism |
|---|---|
| `AUTO_APPLY` | Emit new `to-implement` item with `skip-eligible` permission, source-phase=7. Includes finding text + which review file it came from + brief justification ("matches CLAUDE.md rule X" / "matches Phase 1 success criterion Y"). |
| `AUTO_SKIP` | Mark finding closed in triage.md with brief justification ("pre-existing, out of scope" / "false positive given Phase 1 architecture-impact" / "stylistic, not in CLAUDE.md"). No work emitted. |
| `ASK` | Emit ASK item in state file. Source-phase=7. Includes finding text + "checked against: CLAUDE.md, repo-profile.md, architecture-impact.md, docs/adr/; answer not found" audit line per Q-escalation-discipline. |

**Inputs:**
- `.workflow/iter-N/review/{architecture,ddd,general}-review.md`
- Phase 1 artifacts (`plan.md`, `repo-profile.md`,
  `architecture-impact.md`)
- `~/.claude/CLAUDE.md` and `<repo>/CLAUDE.md`
- `<repo>/CONTEXT.md`, `<repo>/docs/adr/`, other docs (read on demand)
- Prior `iter-*/triage.md` for self-bail awareness

**Does NOT see:** Phase 4 prompts, Phase 4 implementer's chain-of-
thought, Phase 5 validation narratives. Sympathy-of-implementation
immunity per the no-narrative rule.

**Tool whitelist:**

```bash
claude -p "$(cat .workflow/prompts/phase7.md)" \
  --dangerously-skip-permissions \
  --allowedTools "Read,Glob,Grep,Write" \
  --model sonnet
```

- `Read,Glob,Grep`: artifacts + docs
- `Write`: emit `triage.md`, update state file
- NOT `Edit`: triager doesn't modify code (the load-bearing constraint
  preventing inline fixes)
- NOT `Bash`: prevents `git apply` / patch shortcuts
- NOT `Skill`: triager decides on its own, no delegation

**Output:**
- `.workflow/iter-N/triage.md` — per-finding decisions + rationale
- State file updates: new `to-implement` items (AUTO_APPLY), new ASK
  items, closed source review-finding markers

**No count-based cap.** Triager self-bails when same findings recur
across prior iterations' triage.md files. Appends DECISION + exits.

### Q-phase8: Phase 8 Design Critique — Phase 7's UI twin (LOCKED)

Phase 8 runs iff `ui_work=true`. Same shape as Phase 7 but operating on
design dimensions (visual hierarchy, accessibility, brand consistency,
interaction polish). May invoke `/e2e-validate` in chunk mode for
re-screenshots after design-related changes.

**Same trichotomy** (AUTO_APPLY / AUTO_SKIP / ASK), same skip-eligible
permission authority for AUTO_APPLY items (per Q-fast-route), same
no-narrative input discipline.

**Inputs:**
- `.workflow/design-brief.md` (Phase 3)
- Screenshots from `/e2e-validate` re-screenshot pass
- Phase 1 artifacts
- CLAUDE.md + design docs (DESIGN.md, design-tokens, etc.)
- Prior `iter-*/design-critique.md`

**Tool whitelist:** `Read,Glob,Grep,Write,Skill,Bash` (Skill for
`/e2e-validate`; Bash for any commands the validation skill needs).

**Output:** `.workflow/iter-N/design-critique.md` + state file updates.

### Q-phase4: Phase 4 Implement (LOCKED)

**Artifacts available to Phase 4 implementer:**

```
.workflow/
├── research.md              ← Phase 1
├── repo-profile.md          ← Phase 1 (architectural principles, file:line)
├── architecture-impact.md   ← Phase 1 (branch 1/2/3, state delta,
│                              taste-preservation contract)
├── plan.md                  ← Phase 1 → Phase 2 (REVIEWs resolved)
├── design-brief.md          ← Phase 3 (if ui_work=true)
├── open-decisions.md        ← Phase 2 (HUMAN items resolved)
└── user-overrides.md        ← any user redirections
```

Plus the live repo for `Read`/`Glob`/`Grep`.

**Model:** Sonnet 4.6, uniform across all phases (see Q-model-uniform).

**Tool whitelist:**

```bash
claude -p "$(cat .workflow/prompts/phase4.md)" \
  --dangerously-skip-permissions \
  --allowedTools "Read,Glob,Grep,Edit,Write,Bash" \
  --model sonnet
```

- `Read,Glob,Grep`: read existing code + Phase 1–3 artifacts
- `Edit,Write`: implement (Edit for modifications, Write for new files)
- `Bash`: limited use — git operations, file system queries. NOT for
  validation (that's Phase 5's job).
- NOT `Skill`: implementation should not invoke other skills
- NOT `WebSearch`/`WebFetch`: research is Phase 1's job; gaps escalate,
  do not trigger inline research
- NOT `Task`: no depth-2 spawning from implementer

**Chunking** (the state machine handles it naturally):

When Phase 1 emits a plan with logical groupings, it writes multi-chunk
checkboxes:

```
- [ ] Phase 4a: theme context (steps 1-3)
- [ ] Phase 4b: toggle component (steps 4-6)
- [ ] Phase 4c: settings page integration (steps 7-8)
```

Orchestrator walks them sequentially. Each chunk = one Sonnet
subprocess + one git commit. If 4b fails, restart picks up at 4b; 4a's
work is safe in git.

**Chunking trigger:** Phase 1's judgment, no hard threshold. Hint:
logical commit boundaries are the right axis, not file count. Soft cap
~10 files per chunk to keep individual contexts focused.

**Gap-handling policy (strict — load-bearing):**

If the implementer hits ambiguity that Phase 1 didn't resolve, it must
NOT silently invent. Phase 4 prompt enforces:

> If any plan step is not unambiguously executable, append
> `- [ ] DECISION: <specific question>` to plan.md and exit
> incomplete. Do not improvise. Do not invent. Do not assume.

Orchestrator detects pending DECISION → universal human resumption
mechanism. Reflection (Phase 11) catches repeated escalations as Phase
1 quality signals (planner is under-specifying).

**Status emission on chunk completion (NO inline self-validate):**

Phase 4 does NOT run validation inline. Reason: validation may require
multi-modal payloads (screenshots, large test reports) that bloat the
implementer's context. Separation gives each subprocess a bounded
responsibility and its own token budget.

On chunk completion the implementer writes `.workflow/status.md`:

```
phase: 4
chunk: 4a
status: Code Complete but Unverified
commit: <git-sha>
```

Orchestrator reads status. "Code Complete but Unverified" → spawns
Phase 5 E2E Validate.

**Inner loop runs at Phase 4↔5 boundary, not inside Phase 4.**
See Q-phase5.

**Why this works with Sonnet:** Phase 1's multi-artifact structure
gives the implementer specific file:line evidence, architecture
contract, and design tokens. Sonnet is strong at pattern-matching and
mechanical translation; the structured artifacts give it the bounded
judgment context it needs. Sonnet's weakness — resolving ambiguity in
vague specs — is mitigated by the gap-escalation policy: ambiguity
becomes a DECISION item, never improvisation.

### Q-phase5: Phase 5 E2E Validate (LOCKED)

User reframe: validation deserves its own phase with its own context
budget because it may involve multi-modal payloads (screenshots,
visual-loop output, large test reports). Phase 4 emitting
"Code Complete but Unverified" → Phase 5 runs validation → state
machine routes based on outcome.

**Status enum (the state machine signal):**

```
Code Complete but Unverified           ← Phase 4 emits on chunk done
E2E Validated and Passing              ← Phase 5 success → advance to Phase 6
E2E Validation Failed: Code Errors     ← tests fail, build broken, runtime errors
E2E Validated but Requirements Unmet   ← code runs, doesn't fulfill Phase 1 success criteria
Unable to Validate: No Harness         ← no test runner, no smoke fits — escalate
```

The "Requirements Unmet" state is the load-bearing one — Phase 5 doesn't
just check "does it compile/run." It checks "does it fulfill the success
criteria Phase 1 declared." For UI work: load the page, screenshot,
verify the requested feature is visible (e.g. "dark mode toggle visible
in settings").

**Reads:**
- Phase 1 `plan.md` (for success criteria)
- Phase 1 `architecture-impact.md` (taste-preservation contract)
- Phase 3 `design-brief.md` (if ui_work=true)
- `.workflow/status.md` (which chunk just completed)
- The live repo

**Writes:**
- `.workflow/status.md` (updated with new status)
- `.workflow/validation-report.md` (details when status != passing)

**Loop-back semantics (per-status dispatch):**

```
status                                  → orchestrator action
──────────────────────────────────────────────────────────────────────
E2E Validated and Passing               → advance to Phase 6
E2E Validation Failed: Code Errors      → loop back to Phase 4 (iter N+1)
E2E Validated but Requirements Unmet    → loop back to Phase 4 (iter N+1)
Unable to Validate: No Harness          → escalate to user (DECISION
                                          item: "no harness — add tests/
                                          build before continuing, or
                                          accept gap")
```

Why "Unable to Validate" escalates rather than loops: re-implementing
in Phase 4 doesn't add a test harness; looping would be infinite.
Project-level gap → human decision.

**Loop-back appends:**
1. Orchestrator reads `validation-report.md`
2. Appends `- [ ] Phase 4 (iter N+1): re-implement per validation-report.md`
3. Appends `- [ ] Phase 5 (iter N+1): re-validate` after it
4. Continues — orchestrator picks up the new Phase 4 [ ] on next iteration

**No count-based cap. Agent self-bail.**

Count-based caps are arbitrary — they don't know if progress is
happening. Cybernetic alternative: each agent reads prior iterations'
artifacts before working, judges whether progress is real, and bails
when stalled.

```
You are Phase 4, iteration N+1.
Prior iterations:
  N-2: .workflow/iter-N-2/validation-report.md, plan-attempt.md
  N-1: .workflow/iter-N-1/validation-report.md, plan-attempt.md
Before implementing, check whether you're making real progress. If
prior fix attempts produced the same failure mode, append
"- [ ] DECISION: <specific reason no progress, e.g. 'same NullPointer
at src/x.ts:42 in last 2 iterations, my fix in iter N-1 did not
address the actual root cause'>" to plan.md and exit.
```

Either Phase 4 (implementer) or Phase 5 (validator) can bail. Whichever
side recognizes stall first appends DECISION and exits. Orchestrator
detects DECISION → universal human resumption mechanism.

**Iteration history is surfaced via `.workflow/iter-N/` subdirectories.**
Each iteration writes its artifacts (plan-attempt.md, status.md,
validation-report.md, commit ref) into its own subdirectory.
Orchestrator passes pointers to N most recent iterations into each
phase prompt.

**Same principle applies to the outer 4→5→6→7 loop.** If Phase 7 Triage
keeps producing the same AUTO_APPLY findings across iterations (fixes
didn't stick), the triager bails with DECISION. No iteration count cap.

**Status enum is routing signal, not truth.** `validation-report.md`
carries the detailed reasons regardless of enum value. Phase 5 always
writes informative comments. Enum extensibility is not a concern —
edge cases live in the report, not in the enum.

**Outer cap (4→5→6→7 loop): 3 iterations** — same as before for
review/triage findings driving re-implementation.

**Tool whitelist:**

```bash
claude -p "$(cat .workflow/prompts/phase5.md)" \
  --dangerously-skip-permissions \
  --allowedTools "Read,Glob,Grep,Skill,Write,Bash" \
  --model sonnet
```

- `Read,Glob,Grep`: read artifacts, repo state
- `Skill`: invoke `/e2e-validate` (extracted skill, see Q-validate-skill)
- `Write`: emit status.md + validation-report.md
- `Bash`: run shell commands the validation skill needs (test commands,
  build commands, curl, screenshot capture)
- NOT `Edit`: validators don't modify code

### Q-validate-skill: Extract `/e2e-validate` skill (LOCKED)

Feature-loop's Phase 6 Verify recipes (currently embedded in feature-loop
SKILL.md) extracted into a standalone skill. Cross-cutting reuse:
both `/workflow` (Phase 5) and `/feature-loop` (could replace its inline
Phase 6 recipes) invoke it.

**Location:** `.apm/skills/e2e-validate/SKILL.md` in the kit.

**Declared as preset dep** in `workflow.yaml`. Also in `feature-loop.yaml`
once feature-loop is migrated.

**Skill interface:**

```
Inputs (passed via prompt to the skill invocation):
  - mode: "chunk" | "full-repo"
  - changed_files: list of paths (when mode=chunk)
  - success_criteria: from Phase 1 plan.md
  - ui_work: bool
  - stack: from Phase 1 (TypeScript / React / Vite / Electron / etc.)

Process:
  1. Discover repo harness (package.json scripts, Cargo.toml,
     Makefile, CI config — don't invent).
  2. Pick smoke recipe by stack:
     - TS/Node:        tsc --noEmit + npm test + node --check entry
     - Vite/Next/SPA:  npm run build + boot dev server + curl /
                       + web-visual-loop if installed + screenshot
     - Electron:       build + electron-visual-loop screenshot
                       + element existence check
     - Backend API:    curl representative inputs + DB migration dry-run
     - Static HTML:    parse HTML + regex-assert critical IDs / aria
     - Default:        emit "no recipe fits" finding
  3. If ui_work, capture screenshot + verify success-criteria
     features visible.
  4. Route stubborn failures to /diagnose if installed.

Outputs:
  - status: one of the enum values above
  - report: detailed findings (commands run, output excerpts,
            screenshot paths, specific failure reasons)
```

**Reuse beyond Phase 5:** Phase 8 Design Critique can also invoke
`/e2e-validate` in chunk mode for visual checks (re-screenshot after
design-related changes).

### Q-phase6: Phase 6 Code Review — three parallel reviewers, bash-level fan-out (LOCKED)

**Drop the `/code-review` plugin.** The Anthropic plugin is PR-required
(`gh pr view` / `gh pr comment`), gh-only tool whitelist, and posts
results to GitHub. `/workflow` Phase 6 runs mid-loop, pre-PR — no PR
to operate on, no GitHub destination. Wrong shape.

**Three parallel reviewer sub-agents, dispatched by the bash
orchestrator** (not by a Phase 6 orchestrator agent spawning Task).
Phase 5 emits a clean signal (status = `E2E Validated and Passing`) which
the orchestrator uses to kick off review. No depth-2 spawning needed —
the three reviewers are siblings at depth=1, like any other phase agent.

**The three reviewers:**

| # | Reviewer | Skill invoked | Output file |
|---|---|---|---|
| 1 | Architecture | `/improve-codebase-architecture` | `.workflow/iter-N/review/architecture-review.md` |
| 2 | DDD | `/improve-DDD-architecture` (new — see Q-ddd-skill) | `.workflow/iter-N/review/ddd-review.md` |
| 3 | General | none — direct diff review | `.workflow/iter-N/review/general-review.md` |

**Reviewer 3 (General)** is a straightforward "review the diff" agent.
It computes the diff itself (`git diff <phase4-start-sha>..HEAD`), reads
changed files, surfaces issues. No specialized skill. Sonnet figures out
what to flag on its own.

**Launch pattern (bash orchestrator):**

```bash
claude -p "$(cat .workflow/prompts/phase6-arch.md)" \
  --dangerously-skip-permissions \
  --allowedTools "Read,Glob,Grep,Bash,Write,Skill" \
  --model sonnet &

claude -p "$(cat .workflow/prompts/phase6-ddd.md)" \
  --dangerously-skip-permissions \
  --allowedTools "Read,Glob,Grep,Bash,Write,Skill" \
  --model sonnet &

claude -p "$(cat .workflow/prompts/phase6-general.md)" \
  --dangerously-skip-permissions \
  --allowedTools "Read,Glob,Grep,Bash,Write" \
  --model sonnet &

wait
```

`Skill` is whitelisted on reviewers 1 and 2 (they invoke specialized
skills); reviewer 3 doesn't need it. None get `Edit` — reviewers are
read-only against the codebase, write-only against `.workflow/`.

**Skills run as-is, no report-only-mode coercion.** Earlier candidate
mitigation was to force `/improve-codebase-architecture` and the DDD
skill into a non-interactive mode (suppress their grilling loops).
**Dropped.** Reasons:
- Subprocess agent under `claude -p` is one-shot — produces output and
  exits regardless of whether the skill asks a question that goes
  unanswered. The artifact (HTML report / markdown findings) lands on
  disk either way.
- Phase 7 Triage reconciles using rules, not by interpreting the skill's
  interaction state. If the skill emitted candidates, triage works with
  candidates.
- Coercing skills into custom modes via prompt scaffolding is fragile
  (depends on the skill author not refactoring their protocol). Letting
  them run their natural protocol and consuming the artifact is robust.

**No confidence scoring at Phase 6.** The Anthropic plugin's 0–100
rubric is not adopted. Each reviewer writes raw findings as readable
markdown. Aggregation, normalization, and triage decisions are
Phase 7's job — pre-empting them at Phase 6 would partially defeat
Phase 7's separate-context purity.

**No findings.jsonl.** The original handoff sub-question about JSONL
fields dissolves. Phase 7 reads three markdown files and triages
directly. If a normalized intermediate proves useful later (Phase 11
reflection input?), it's an additive concern — not Phase 6's emission.

**Iteration directory:** each iteration writes to its own
`.workflow/iter-N/review/` subdirectory (consistent with the iter-N
discipline already locked in Q-no-caps). Triage on iteration N reads
iter-N review files; Phase 11 reflection can scan iter-N-1, iter-N-2
etc. for trends.

**Skills as preset dependencies.** `improve-codebase-architecture` and
`improve-DDD-architecture` declared in `workflow.yaml`. The DDD skill is
a build-it dependency (see Q-ddd-skill).

### Q-ddd-skill: `improve-DDD-architecture` skill — new dependency (LOCKED scope, BUILD pending)

A new skill modeled structurally on `improve-codebase-architecture` but
DDD-focused. Built as a separate task; declared as a Phase 6 dependency.

**Shape:**

- **SKILL.md is a distilled DDD runbook**, not a verbatim docs dump.
  The meat: ubiquitous language discipline, bounded contexts, aggregates
  vs. entities vs. value objects, anti-corruption layers, hexagonal
  architecture (ports + adapters), repositories, domain events,
  application services. Core review heuristics for diff-time use.
  Distilled so the skill aligns with DDD rather than relying on the
  agent's training-baked notion of DDD.

- **Reference sub-files** (`references/`):
  - `references/domain-driven-hexagon/` — markdown captured from
    https://github.com/Sairyss/domain-driven-hexagon (TypeScript-oriented).
    Captured at skill-build time; updated periodically.
  - `references/dotnet/` — .NET-oriented DDD reference repo.
    **URL pending — user to supply.** Captured similarly. Not a primary
    input; reference for deeper-dive research only.

- **Review-focused output.** Reads diff, surfaces DDD violations:
  - Anemic domain models (entities without behaviour)
  - Infrastructure leaking into domain layer
  - Aggregate boundaries crossed inappropriately
  - Missing ubiquitous-language alignment with `CONTEXT.md`
  - Application services doing domain work
  - Missing anti-corruption layers at external boundaries

- **Tone:** runs as-is in Phase 6, no report-only-mode coercion. Emits a
  markdown findings file. Interactive grilling sections (if any) are
  emitted but ignored by Phase 6 — Phase 7 picks up the findings
  content.

**Build is separate work.** Scope captured here so Phase 6 references
something concrete. Skill creation via `/write-a-skill` or
`/skill-creator` in a follow-up session.

### Q-model-uniform: Single model across all phases for MVP (LOCKED)

**Decision:** Sonnet 4.6 for every phase. No per-phase model selection.

**Rationale:**
- Strong enough for Phase 1 architectural analysis, Phase 2 plan
  review, Phase 6 triage rule reasoning, Phase 11 reflection
- Strong enough for Phase 4 implementation given Phase 1's structured
  artifacts
- 5x cheaper than all-Opus across the board
- One model = one launch incantation template, simpler orchestrator

**Trade-off accepted:** Opus would be safer on the most load-bearing
judgment phases (Phase 1, Phase 6). We bet Phase 1's multi-artifact
discipline compensates. Reflection phase signals which specific phases
under-perform; per-phase model upgrades happen post-MVP based on
evidence.

**Soft spot:** if Phase 1 quality is consistently shallow under Sonnet,
the whole loop's quality degrades. Sentinel: if reflection flags
"plan.md has DECISION escalations >X% of runs," upgrade Phase 1 to
Opus.

### Q3: Phase 1 collapses Explore + Survey + Plan into one phase (LOCKED, with user's reframe)

Originally proposed as three sub-agents (1a Explore neutral, 1c Survey
judging, 1d Plan drafting). User reframed twice:

**First reframe:** architecture isn't about *finding debt*. It's about
**what the anticipated changes mean to the existing architecture of the
repo / application / domain.**

**Second reframe:** sophistication is **emergent, not classified.** The
planner doesn't assign a tier label (script / focused-module /
multi-module / enterprise). The signal falls out of the analysis — the
granularity of architectural principles the planner names *is* the
sophistication signal. A planner that writes "this repo has bounded
contexts, anti-corruption layers, and an event bus" tells you
sophistication without a tier label. (This dissolves the original Q4
on tier calibration — there is no tier to calibrate.)

**Central question the planner answers:** *What do the changes mean to
the existing architecture?* Branches into a decision tree:

1. **No impact.** Change does not touch architecture. Proceed.
2. **Doable without architecture shift.** Change fits within existing
   principles, including: adding a new module/feature that follows the
   repo's principles. That's growth *along the grain*, NOT a shift.
   Plan may include taste improvements on the planner's judgment.
   Proceed.
3. **Requires architecture shift.** Change cannot be done without
   changing the *grain* — module boundaries, layering, coupling
   patterns, dependency direction. Emits a **pre-planning ASK**: user
   must decide proceed / defer / redesign before plan.md finalizes.

**Key distinction in branch (3):** shift = changing the grain. Growth
along the grain is branch (2). Adding a module that follows existing
principles is NOT a shift.

**Branch (3) flagging:** Phase 1 doesn't emit an ASK directly. It
flags items as "- [ ] REVIEW: <item>" in plan.md. Phase 2 Plan Review
processes them (close on resolution, keep as HUMAN, escalate). If any
HUMAN items remain, orchestrator exits per the universal human
resumption mechanism (see phase layout below).

**Output:** multi-artifact, all written to `.workflow/`:

- `research.md` — index of delegated research artifacts per Q-research
  rule, plus any inline citations
- `repo-profile.md` — architectural principles inferred from the repo,
  with `file:line` evidence. NOT a tier classification — a list of
  patterns / conventions / style the repo embodies. Granularity is
  the sophistication signal.
- `architecture-impact.md` — answers "what do the changes mean to the
  existing architecture?" Includes:
  - Decision-tree branch (1 / 2 / 3) with justification
  - Anticipated state delta (modules touched, surfaces changed, data
    flow, coupling)
  - If branch (2): taste-improvement opportunities (accept neutral
    with justification — don't force invention)
  - If branch (3): pre-planning ASK content
  - Diagram delta (which C4 / ADR / DESIGN.md need updates after
    implementation — applied in Phase 6.5)
- `plan.md` — implementation steps referencing the above. Withheld on
  branch (3) until pre-planning ASK resolves.

**Tools available to planner:** WebSearch, WebFetch, Read, Grep, Glob.
**Tools NOT available:** Edit, Write (except writing artifacts to
`.workflow/`).

---

## Current phase layout

Dispatch is tag-driven per Q-state-machine. The script reads
`.workflow/state.md`, finds the next pending actionable item, and
dispatches the phase that handles that item's tag. Phases listed below
in *typical* run order; actual dispatch sequence depends on what tags
are pending.

```
Phase   Tag handled                              Notes
─────────────────────────────────────────────────────────────────────
1       to-plan                                  multi-artifact (see Q3).
                                                 Emits to-review-plan items
                                                 + to-design (if ui_work)
                                                 + to-implement items.

2       to-review-plan                           Walks each item. Closes
                                                 resolvable ones, escalates
                                                 ambiguous ones as ASK. Phase
                                                 2 re-runs when user supplies
                                                 resolution prompt
                                                 (Q-resolution-via-prompt).

3       to-design                                ui_work=true only. Thin
                                                 agent + swappable design
                                                 skill (Q-phase3). Emits
                                                 design-brief.md +
                                                 to-implement items.

4       to-implement                             No inline validation.
                                                 On completion, emits
                                                 code-complete-needs-
                                                 verification item UNLESS
                                                 source item carried
                                                 skip-eligible permission
                                                 AND Phase 4 judges the
                                                 implementation small-scope
                                                 (Q-fast-route). Bumps
                                                 iter-N when starting a new
                                                 batch (Q-iter-n).

5       code-complete-needs-verification         Invokes /e2e-validate.
                                                 On Passing → emits to-code-
                                                 review item. On Code Errors
                                                 / Requirements Unmet →
                                                 emits new to-implement item
                                                 (new iter). On Unable to
                                                 Validate → escalates ASK.

6       to-code-review                           Three parallel reviewers
                                                 (architecture / DDD /
                                                 general). Each writes a
                                                 markdown findings file to
                                                 iter-N/review/. Diff scope
                                                 = since last-review-sha
                                                 (Q-incremental-review).
                                                 Emits to-triage item.

7       to-triage                                Mirrors Phase 2 (Q-phase7).
                                                 AUTO_APPLY → new to-implement
                                                 with skip-eligible permission.
                                                 AUTO_SKIP → closed. ASK →
                                                 escalated. Phase 4 makes the
                                                 final skip-or-not call after
                                                 implementing.

8       to-design-critique                       ui_work=true only. Phase 7's
                                                 UI twin (Q-phase8). Same
                                                 trichotomy + skip-eligible
                                                 authority.

9       (queue empty, all earlier done)          Documentation — applies
                                                 diagram-delta from Phase 1.

10      (after Phase 9)                          Summary.

11      (after Phase 10)                         Reflection — proposes rule
                                                 amendments as PR-staged
                                                 diffs.
```

State lives in `.workflow/` inside the user's repo (so the human can
edit artifacts with their normal editor between invocations).
Per-phase-dispatch git commits make every state change auditable.

**Single entrypoint (`/workflow`):**

The skill is one slash command, mode-aware. The user invokes it with
optional free-text args. The skill calls the script, forwarding the
args. The script reads `.workflow/state.md` to decide the mode:

```
User invokes /workflow [free-text args]

Script examines .workflow/state.md:

  No state file exists
    → Fresh start. Write a single to-plan item with the user's args as
      the feature request. Loop begins; Phase 1 picks up the to-plan
      item.

  State file exists, actionable items present
    → Resume. Loop dispatches next actionable item. If user args were
      supplied alongside a resumable state, treat them as a
      --user-prompt for the next dispatched phase (most useful when
      ASK items are pending — see Q-resolution-via-prompt).

  State file exists, only ASK/HUMAN/DECISION items present, no
  actionable
    → Resolution-resume. User args carry the resolution context. Script
      dispatches the phase that owns the escalated items, embedding
      args as --user-prompt. Phase re-processes with the new context.

  State file exists, all done (Phase 11 ran)
    → Surface summary. If user args present, prompt: "Start fresh run
      with these args, or just view summary?"

  State file exists, all done EXCEPT Phase 9-11 unrun, no actionable
    → Continue: dispatch Phase 9 → 10 → 11.
```

**Canonical state remains in files.** The script doesn't carry a
conversational front-end — the user's natural-language args + the
phase agent's reasoning ARE the conversational layer. The user can
always edit `.workflow/state.md` directly and re-invoke; the script
re-reads on every dispatch.

**Re-running the script:** idempotent. Reads state from disk, picks up
at first pending actionable item. The script doesn't know humans
intervened; the state file tells the story.

**User-prompt logging:** every invocation's free-text args appended to
`.workflow/user-overrides.log` (one entry per invocation, with
timestamp + which phase received it). Phase 11 Reflection reads this
log for learning signals.

---

## Open questions (queued for grilling)

### ~~Q4: Tier calibration heuristic~~ (DISSOLVED)

Resolved by Q3's second reframe. Sophistication is emergent from the
analysis, not a separate tier classification step. No
`architecture-tiers.md` artifact needed. The planner names the
principles it observes; granularity = sophistication signal.

### Q-phase10: Phase 10 Summary — light, mechanical (LOCKED)

End-of-run human-readable summary. Reads `state.md` + all `iter-*/` +
`reflection.md` (if Phase 11 ran before Phase 10, but it doesn't —
Phase 10 runs first). Emits `.workflow/summary.md`:

- What was requested (Phase 1's goal)
- What was built (Phase 4 commits + final diff stats)
- Iterations summary (how many, why each happened)
- Findings summary (total findings, AUTO_APPLY / AUTO_SKIP / ASK
  breakdown)
- What got escalated and how it resolved
- Status: complete / partially complete with caveats

Tool whitelist `Read,Glob,Grep,Bash,Write`. No skip-eligible. Mechanical.

### Q-deploy: Skill ships vendored at `.apm/skills/workflow/` + `presets/workflow.yaml` preset (LOCKED)

Kit convention: skills vendored under `.apm/skills/<name>/`, presets
under `presets/<name>.yaml`, preset declares dependencies.
`feature-loop.yaml` is the canonical model.

**`/workflow` deploy layout:**

```
.apm/skills/workflow/
  SKILL.md
  orchestrator.sh
  prompts/
    phase1-plan.md
    phase2-plan-review.md
    phase3-design.md
    phase4-implement.md
    phase5-validate.md
    phase6-arch.md
    phase6-ddd.md
    phase6-general.md
    phase7-triage.md
    phase8-design-critique.md
    phase9-documentation.md
    phase10-summary.md
    phase11-reflection.md
  state-template.md
  README.md

.apm/skills/e2e-validate/
  SKILL.md
  recipes/
    ts-node.md
    vite-spa.md
    electron.md
    backend-api.md
    static-html.md

.apm/skills/improve-DDD-architecture/
  SKILL.md
  references/
    domain-driven-hexagon/
    dotnet/                   ← URL TBD from user

presets/workflow.yaml
```

**`presets/workflow.yaml`** declares:

```yaml
name: workflow
description: Cybernetic, self-improving feature-build loop with
  architecture-aware planning, separate-context triage, and
  reflection-driven amendment proposals.
default_agents: [claude]

primitives:
  instructions:
    - core
  skills:
    - workflow
    - e2e-validate
    - improve-codebase-architecture
    - improve-DDD-architecture
    - design-critique
    - diagnose
    - electron-visual-loop
    - web-visual-loop
  plugins:
    - ui-ux-pro-max
    - frontend-design
  mcp: []
  hooks: []
  bundles: []

apm_dependencies: []
```

Note: `code-review` plugin is NOT a workflow dependency (Q-phase6 lock
— wrong shape for mid-loop review). It remains in `feature-loop.yaml`.

**Coexistence with `/feature-loop`:** both presets live in `presets/`.
Simple work uses `/feature-loop`; full architecture-aware + self-
improving work uses `/workflow`. Per out-of-scope: `/workflow` does NOT
replace `/feature-loop`.

### Q-phase11: Phase 11 Reflection — the self-improvement engine (LOCKED)

**Reflection is the cybernetic loop's *meta* layer.** It's not "learn
from user input" — it's "make the workflow skill better at being
useful." Day 0 the skill is imperfect; reflection is what makes day N
better than day 0. Goal: save user time, increase accuracy/correctness,
make the workflow user's leverage.

**Always runs.** No gating, no minimum-overrides threshold. Even pure
autonomous runs produce signal — agents got stuck, did back-and-forth,
spent tokens on trivia, missed points that better docs would have
caught. Reflection mines all of it.

**Signal classes reflection mines:**

1. **Stall / oscillation signals.** Read `iter-*/` to find back-and-
   forth patterns:
   - Same failure mode across iter-N-1 and iter-N (fix didn't address
     root cause)
   - Issue fixed in iter-N then re-introduced in iter-N+1
   - Phase 5 ↔ Phase 4 oscillations that resolved only by accident
   - Self-bail DECISION items that recurred across iterations

   Output: prompt amendments to the relevant phase ("when iter-N-1
   plan-attempt has same failure, treat as <signal>").

2. **Escalation-was-avoidable signals.** Read ASK / HUMAN / DECISION
   items + the CLAUDE.md / docs at the time:
   - Answer was actually in CLAUDE.md but the phase didn't check → tighten
     the Q-escalation-discipline enforcement in that phase's prompt
   - Docs structured so the answer was hard to find → propose docs
     reorganization (specific section header, ADR creation)
   - Recurring same-shape ASK across multiple runs → propose CLAUDE.md
     rule addition

3. **Token / time waste signals.** Examine phase artifacts for verbosity
   disconnected from output value:
   - Phase 6 reviewer produced N-thousand-word artifact, yielded zero
     AUTO_APPLY findings → tighten reviewer prompt or add diff-size gate
   - Phase 1 multi-artifact came out shallow on the change being made
     → propose Phase 1 prompt sharpening
   - Deep exploration on simple changes → propose scope-gating heuristic

4. **Missing-context signals.** Repeated Phase 4 DECISION items that
   all map to the same root concept missing from Phase 1's artifacts →
   propose Phase 1 prompt amendment to better cover that concept area
   for repos like this one.

5. **User-override signals.** When `user-overrides.log` has entries,
   read what the user redirected and infer the underlying preference.
   Propose CLAUDE.md sharpening (global or project) so next run resolves
   the same situation without asking.

6. **What's working signals.** Patterns that consistently produced good
   results get logged as "confirm — don't change." Reflection should
   suppress changes to disciplines that are demonstrably working.
   Stability matters as much as improvement.

**Output is multi-target — the skill itself evolves.** Patches can target:

- `~/.claude/CLAUDE.md` (global rules)
- `<repo>/CLAUDE.md` (project rules)
- `<repo>/CONTEXT.md`, `<repo>/docs/adr/` (project domain docs)
- The `/workflow` skill's `SKILL.md`
- The `/workflow` skill's prompt templates (`prompts/phase*.md`)
- The orchestrator script (`orchestrator.sh`)
- Phase prompt amendments for dependency skills (e.g.,
  `/improve-codebase-architecture` SKILL.md, when reflection notices
  a recurring shortcoming there)

**Output files:**

- `.workflow/reflection.md` — narrative observations + classification
  per signal class above + summary recommendations
- `.workflow/reflection.patch` — unified diff against the targets
  listed above. User reviews `reflection.md`, applies `reflection.patch`
  with `git apply` if accepted. The workflow NEVER auto-applies.
- `.workflow/reflection-watchlist.md` — observations not yet
  patchable (single observation; need pattern confirmation across
  multiple runs before proposing a change). Future runs' reflection
  reads this and either confirms (escalates to patch) or expires.

**Why PR-staged diffs, not auto-apply:** reflection is the
least-validated phase (reasoning about its own behavior, meta-level).
Auto-applying its conclusions creates a feedback loop with no human
gate. Hard pass. Patches give the user a single review surface, easy
git workflow to accept/reject.

**Why not staged commit:** keeps the user's repo clean of "Claude-
suggested-but-not-yet-accepted" state. The patch is a recommendation
file, not a pending change in git.

**Tool whitelist:**

```bash
claude -p "$(cat .workflow/prompts/phase11.md)" \
  --dangerously-skip-permissions \
  --allowedTools "Read,Glob,Grep,Bash,Write" \
  --model sonnet
```

- `Read,Glob,Grep`: artifacts, overrides log, CLAUDE.md, target skill
  files
- `Write`: emit `reflection.md`, `reflection.patch`, update
  `reflection-watchlist.md`
- `Bash`: construct unified diff (`diff -u` / `git diff --no-color`)
- NOT `Edit`: no in-place edits, ever

**Inputs:**

- `.workflow/state.md` (final state — what closed, what escalated)
- All `.workflow/iter-*/` (full run history)
- `.workflow/user-overrides.log`
- `.workflow/reflection-watchlist.md` (from prior runs, if exists)
- `~/.claude/CLAUDE.md`, `<repo>/CLAUDE.md`, `<repo>/CONTEXT.md`,
  `<repo>/docs/adr/`
- The `/workflow` skill's own files (SKILL.md, prompts/, orchestrator)
- Dependency skill files (read-only; patches can propose changes)

**No skip-eligible / loop-back.** Phase 11 is terminal. Its output
doesn't trigger more workflow execution; it triggers the user's
external review-and-apply step.

**Trend tracking across runs.** `reflection-watchlist.md` persists
across workflow runs (lives in the user's repo's `.workflow/`). Run N+1
reads Run N's watchlist; observations confirmed → patch; observations
not reproduced → expire (drop after K runs without confirmation, K=3).

**The leverage compounding mechanism:** every accepted patch makes the
next run cheaper, more accurate, less interruptive. Over time, CLAUDE.md
accumulates project wisdom, phase prompts converge on what works for
this user's style, the workflow becomes a force multiplier rather than
a chore.

### ~~Q5: Phase 9 Documentation — own phase or fold into Phase 4 Implement?~~ (LOCKED as own phase)

Locked as **own phase at end-of-queue.** Triggered when actionable
queue is empty (state-machine condition for Phase 9 → 10 → 11
dispatch). Reads `architecture-impact.md`'s diagram-delta + all Phase 4
batch commits + all phase artifacts. Mechanical sweep: updates ADRs,
C4 sources, DESIGN.md, READMEs. Tool whitelist
`Read,Glob,Grep,Edit,Write,Bash`. No skip-eligible / loop-back.

If Phase 9 finds genuine ambiguity it escalates as ASK; otherwise
emits no-op status and advances to Phase 10.

Folding into Phase 4 was rejected because docs reflect end-state, not
intermediate state — updating docs mid-loop wastes work when later
iterations shift the architecture again. Tag-based emission (each
phase emits to-document items) was rejected because it creates
duplicate / inconsistent partial coverage — Phase 9 at end sees the
union by design.

### ~~Q6: Phase 7 (was Phase 6) Triage — rule-corpus bootstrap + ASK semantics~~ (DISSOLVED)

Resolved across Q-phase7-rules (no separate rule corpus — Phase 7 reads
CLAUDE.md + Phase 1 artifacts + prompt-embedded criteria), Q-phase7
(structural lock), and Q-escalation-discipline (the no-bootstrap rule
generalizes to all phases). Bootstrap problem dissolves: no corpus to
seed.

### ~~Q7: Phase 11 Reflection gating + output~~ (LOCKED as Q-phase11)

Resolved by Q-phase11. Reflection always runs (no gating). Mines six
signal classes, not just user overrides. Output is `reflection.md` +
`reflection.patch` (multi-target: CLAUDE.md, skill files, dependency
skills, docs) + `reflection-watchlist.md` (cross-run pattern tracker).
User reviews + `git apply` to accept. Never auto-applies.

### ~~Q-deploy: where does the skill ship from?~~ (LOCKED — see Q-deploy in Locked decisions)

Resolved per kit convention. Skill at `.apm/skills/workflow/`, preset
at `presets/workflow.yaml`. Same shape as `/feature-loop`.

---

## Known soft spots (the critique register)

These are real risks identified during grilling. Mitigations are
proposed, not yet locked.

1. **Planner shallowness risk.** Phase 1 does research + repo-profile +
   arch-impact + plan in one sub-agent. Risk of shallow on all four.
   Mitigation: artifact-per-step structure — shallowness is visible
   (empty repo-profile.md is auditable). If consistently shallow,
   reflection-phase finding.

2. ~~**Tier calibration fuzziness.**~~ Dissolved with Q4 — sophistication
   is emergent, no tier classification step.

3. **Net-improvement bar can paint into corners.** "Reduce complexity
   or justify" — sometimes the honest answer is "neutral, this is a
   feature addition that fits." Bar should accept *neutral with
   justification*, not require improvement. Otherwise planner invents
   improvements.

4. **Triage no-context constraint demands unusually well-crafted rules.**
   First N sessions probably 80% ASK. Bootstrap problem. Q6 addresses.

5. **Reflection bootstrap empty.** Pure autonomous runs have no
   overrides → reflection emits nothing. Dogfood acceptance test from
   the handoff can't validate this phase. Q7 addresses.

6. **Orchestrator complexity.** "30 lines of bash" is dishonest.
   Realistic 150–250 lines with non-trivial control flow. Honest scope.

7. **`.workflow/` directory in user's repo is noise.** Decision:
   accept the noise — putting it elsewhere defeats inspectability /
   override-ability. User can `cd` and edit normally. Add to
   `.gitignore` template; user opts in to committing if desired.

8. ~~**Phase numbering with halves.**~~ Resolved — renumbered 1–11
   sequential.

9. **Phase 2 over-closure risk.** Plan Review reviewer could bury
   architectural risks under unjustified "judgment reversal" closes.
   Mitigation: every CLOSE must include "why I'm overruling Phase 1"
   line. Reflection (Phase 11) audits patterns over time.

10. **Mode detection edge cases.** Skill examining `.workflow/` state
    must handle: corrupted state files, partial writes (orchestrator
    SIGKILL'd mid-phase), concurrent invocations, user edits that
    violate format. Recovery story: skill validates state on entry,
    offers user "reset Phase N" option if corrupt.

11. ~~**Phase 3 skill-discovery mechanism needs concrete spec.**~~
    Resolved — no discovery. Skills are preset dependencies, guaranteed
    present.

12. ~~**Skill-composition-via-SKILL.md-reading has limits.**~~ Resolved
    — sub-agent uses canonical Skill tool, skill content loads into its
    context properly.

13. ~~**Generic-heuristics fallback produces mediocre design briefs.**~~
    Resolved — no fallback. Baseline design skills (`ui-ux-pro-max` +
    `design-critique`) ship with the preset.

14. **Claude-only runtime dependency.** Phase 3 (and other
    skill-invoking phases) depend on Claude Code's Skill tool. The
    skill is not Codex-compatible. Acceptable for MVP; Codex
    compatibility was not a stated requirement.

15. **`--dangerously-skip-permissions` is a real risk surface.** The
    orchestrator launches phase agents with permission bypass. If a
    phase prompt is malicious or a skill is compromised, there's no
    user prompt gating tool use. Mitigation: `--allowedTools` whitelist
    limits per-phase what tools are reachable; phase agents are not
    given Bash or Edit unless that phase legitimately needs them
    (Phase 4 Implement does, Phase 3 Design does not).

---

## Out of scope (explicit non-goals)

- **CLAUDE.md §2.5 "Architecture Is Load-Bearing" section.** Original
  handoff bundled this with the skill build. Separate concern, separate
  session. Recorded for follow-up but not part of this deliverable.
- **Replacing `/feature-loop`.** Both skills coexist. Simple work uses
  `/feature-loop`, full architecture-aware work uses `/workflow`.
- **Ralph Loop model-swap mechanic.** The cybernetic value is
  determinism and inspectability, not literal model-swapping mid-loop.
  Stateless subprocess design enables swap if ever wanted, but it's not
  a goal.

---

## Decision log (for compaction-resistance)

Append to this section as decisions land. Format: `YYYY-MM-DD — Q# —
decision — one-line reason`.

- 2026-05-28 — Q1 — Fork into separate skill — runtime differs
- 2026-05-28 — Q2 — Bash 3.2-compatible orchestrator — kit convention
- 2026-05-28 — Q3 — Collapse Phase 1 into single multi-artifact planner — user reframe: architecture is anticipated state delta, not debt
- 2026-05-28 — Q-design-location — In-repo at `docs/design/` — durability across context compaction
- 2026-05-28 — Q-research — Research delegation rule (small inline / sizable via checkbox+sub-agent) — prevents context bloat and preserves determinism via state machine
- 2026-05-28 — Q3 second reframe — Sophistication is emergent (not tier-classified); branch (1)/(2)/(3) decision tree; pre-planning ASK on branch (3) — keeps Phase 1 honest about what changes mean to architecture without forcing arbitrary tier labels
- 2026-05-28 — Q4 — DISSOLVED by Q3 reframe — no tier calibration needed
- 2026-05-28 — Q-phase0 — Drop Phase 0 Parse; absorb into Phase 1 state-machine checkboxes — Phase 1 reads request anyway
- 2026-05-28 — Q-plan-review — New Phase 2 Plan Review between planning and human ASK — fresh-context reviewer can close resolvable items, only escalate genuine ambiguity
- 2026-05-28 — Q-resumption — Human resumption via files (canonical) + optional /workflow-resolve agent (ergonomic); orchestrator exits on open decisions, re-entry is just re-running the same script — cybernetic invariant preserved, human-friendly shell layered on top
- 2026-05-28 — Q-renumbering — Sequential 1–11, no halves — clarity over preserved "insertion" semantics
- 2026-05-28 — Q-single-entrypoint — `/workflow` is mode-aware single entrypoint; no separate `/workflow-resolve`; skill detects state and dispatches (fresh / resume / resolve-decisions / abandon-or-finish) — eliminates fourth sub-agent type, keeps cybernetic invariant (files are canonical), adds humane conversational front-end
- 2026-05-28 — Q-phase3 — Phase 3 is thin agent + swappable design skill; discovers installed design skill, follows its protocol inline; no Phase 4 Design Review (design judgment outsourced to invoked skill) — `/workflow` doesn't encode design opinions, design knowledge lives in other people's skills
- 2026-05-28 — Q-phase3-deps — `ui-ux-pro-max` + `design-critique` are hard preset dependencies, not runtime-discovered; Phase 3 sub-agent invokes them via canonical Skill tool; launched via `claude -p --dangerously-skip-permissions --allowedTools "Read,Glob,Grep,Write,Skill"` — eliminates discovery complexity, uses canonical composition mechanism
- 2026-05-28 — Q-phase4 — Phase 4 Implement: reads all earlier-phase artifacts, tool whitelist `Read,Glob,Grep,Edit,Write,Bash`, chunked when Phase 1 declares it, strict gap-escalation policy (no improvisation) — keeps implementer mechanical, gaps surface as Phase 1 quality signals
- 2026-05-28 — Q-phase4-validate — Phase 4 chunks must achieve local functionality before completion (inner loop: implement → tsc/lint/tests → fix → re-validate, cap 5 iterations) — cleaner separation of correctness (Phase 4) vs quality (Phase 5), reduces wasted Phase 5 iterations
- 2026-05-28 — Q-phase5-restructure — Validation extracted from Phase 4 into dedicated Phase 5 E2E Validate. Phase 4 emits status "Code Complete but Unverified" only. Phase 5 invokes /e2e-validate skill (multi-modal-friendly, own token budget). State enum drives orchestrator dispatch. Inner 4↔5 cap=3. Old Phase 8 Verify dissolved into Phase 5. — token economics + cleaner state-machine signaling + reusable validation skill
- 2026-05-28 — Q-validate-skill — Extract /e2e-validate skill from feature-loop's inline Phase 6 recipes. Vendored at `.apm/skills/e2e-validate/SKILL.md`, declared as preset dep in workflow.yaml (and eventually feature-loop.yaml). Reusable by Phase 5 (correctness validation) and Phase 8 (design-related re-validation). — cross-skill recipe library, prevents drift
- 2026-05-28 — Q-phase5-dispatch — Per-status orchestrator dispatch (not uniform "non-passing → loop back"). "Unable to Validate" escalates to user (no harness to fix via re-implementation). Status enum extensibility dissolved: validation-report.md carries truth, enum is just routing.
- 2026-05-28 — Q-no-caps — No count-based iteration caps anywhere in the loop. Agent self-bail discipline: each agent reads prior iterations' artifacts (`.workflow/iter-N/`), judges progress, appends DECISION + exits when stalled. Applies to inner 4↔5 loop AND outer 4→5→6→7 loop. — cybernetic over arbitrary counts; agents have context to judge, counters don't.
- 2026-05-28 — Q-model-uniform — Sonnet 4.6 across all phases for MVP — simpler orchestrator, single price point, reflection signals will drive per-phase upgrades post-MVP
- 2026-05-28 — Q-phase6 — Phase 6 = three parallel reviewers (architecture / DDD / general) dispatched by bash orchestrator with `&` + `wait`; each writes raw markdown findings to `.workflow/iter-N/review/`. No `/code-review` plugin (PR-required, wrong shape). No findings.jsonl, no confidence scoring — Phase 7 owns triage. Skills invoked as-is, not coerced into report-only mode (subprocess one-shot + Phase 7 reconciliation absorbs interactive-mode artifacts naturally).
- 2026-05-28 — Q-ddd-skill — New `/improve-DDD-architecture` skill modeled on `/improve-codebase-architecture`: distilled DDD runbook as SKILL.md (ubiquitous language, bounded contexts, aggregates, ACLs, hex arch) + raw reference docs as sub-files (domain-driven-hexagon repo + .NET reference repo TBD). Build is separate work; declared as Phase 6 preset dependency.
- 2026-05-28 — Q-escalation-discipline — Cross-cutting rule: before any phase escalates (REVIEW/HUMAN/DECISION/ASK/Unable-to-Validate), agent must check CLAUDE.md (global + project), CONTEXT.md, docs/adr/, docs/, and Phase 1 artifacts. Only escalate if answer genuinely absent. Each escalation entry includes "checked against: <docs>" audit line. Phase 11 reflection catches violations and proposes CLAUDE.md sharpenings or prompt-template tightenings.
- 2026-05-28 — Q-phase7-rules — Phase 7 has NO separate `triage-rules.md` corpus. Mirrors Phase 2's pattern: prompt-template-embedded decision criteria + artifact-grounded reasoning (3 review files + Phase 1 artifacts + CLAUDE.md). Phase 11 reflection loops learning back through CLAUDE.md amendments, not a separate triage corpus. Dissolves Q6 handoff sub-questions on rule location, bootstrap, and rule template.
- 2026-05-28 — Q-state-machine — FOUNDATIONAL: state file is a tagged work-item queue, not a phase-checkbox list. Script dispatches via tag table (to-plan→1, to-review-plan→2, to-design→3, to-implement→4, code-complete-needs-verification→5, to-code-review→6, to-triage→7, to-design-critique→8). Adding a phase = adding a tag + dispatch row, no script change. Supersedes "Phase N checkbox" framing in earlier Q-phase4/5/6 locks (substance unchanged, mechanism replaced).
- 2026-05-28 — Q-pause-discipline — Only the script pauses; only when no actionable items remain AND at least one ASK/HUMAN/DECISION exists. Phase agents never pause — they emit items and exit. Implies best-effort-before-pause: mixed batches (e.g., Phase 7 with 3 auto + 2 ASK) process the 3 fully before pausing on the 2.
- 2026-05-28 — Q-resolution-via-prompt — CORRECTION to earlier draft: user resolution is NOT written to open-decisions.md. User re-invokes `/workflow <free-text>`; skill forwards text as `--user-prompt` arg; script embeds in next phase's prompt. Phase re-processes pending items WITH user context. Free-text args logged to `.workflow/user-overrides.log` for Phase 11 reflection input. Hand-edit path still supported as power-user fallback.
- 2026-05-28 — Q-iter-n — Iteration counter bumps every time Phase 4 starts a NEW BATCH of to-implement items (Phase 1 batch = iter-1, Phase 5 retry = iter-2, Phase 7 AUTO_APPLY = iter-3, Phase 8 AUTO_APPLY = iter-4). Within a batch, all chunks share one iter-N/ directory. Skip-tagged items still bump iter-N (Phase 4 ran) but skip downstream phases. Prior iter-* directories preserve plan-attempt.md, status.md, validation-report.md, review/, triage.md for self-bail discipline (Q-no-caps).
- 2026-05-28 — Q-incremental-review — Phase 6 reviewers diff against `<last-review-sha>` (recorded in `.workflow/iter-N/review/sha.txt`), not the whole branch. First iteration's last-review-sha = Phase 4-start sha. Skip-route items don't update last-review-sha; the next non-skipped Phase 6 picks up the unreviewed commits naturally.
- 2026-05-28 — Q-fast-route — CORRECTION to earlier draft: Phase 7/8 emit `skip-eligible` permission on AUTO_APPLY items (a HINT, not a verdict). Phase 4 implements, sees actual scope, then declares `no-verification-needed` / `no-review-needed` skip tags iff scope is genuinely small. Phase 1-emitted items NEVER get skip-eligible (full validation always). Script enforces: skip tags only valid on skip-eligible items, skip-eligible only valid from Phase 7/8.
- 2026-05-28 — Q-phase7 — Phase 7 locked structurally: mirrors Phase 2, walks each finding across the 3 review files, emits AUTO_APPLY/AUTO_SKIP/ASK. AUTO_APPLY → new to-implement with skip-eligible. AUTO_SKIP → closed with justification. ASK → escalated with "checked against docs" audit line. Tool whitelist Read,Glob,Grep,Write only — no Edit (preserves no-narrative + inline-fix immunity). No count-based cap; self-bail via prior iter-*/triage.md.
- 2026-05-28 — Q-phase8 — Phase 8 Design Critique = Phase 7's UI twin. Same trichotomy, same skip-eligible authority, same no-narrative input discipline. Tool whitelist Read,Glob,Grep,Write,Skill,Bash (Skill for /e2e-validate re-screenshots; Bash for validation commands). Output to iter-N/design-critique.md.
- 2026-05-28 — Q5 — Phase 9 Documentation = own phase at end-of-queue, not folded into Phase 4 (docs reflect end-state, not intermediate) and not tag-emitted mid-loop (creates partial/inconsistent coverage). Reads architecture-impact.md diagram-delta + all Phase 4 commits + all artifacts. Mechanical sweep of ADRs, C4, DESIGN.md, READMEs. Tool whitelist `Read,Glob,Grep,Edit,Write,Bash`. Escalates ASK only on genuine ambiguity.
- 2026-05-28 — Q-phase11 — Phase 11 Reflection is the self-improvement engine. Always runs (no gating). Mines six signal classes: stalls/oscillations, avoidable escalations, token waste, missing-context, user overrides, what's-working. Outputs `reflection.md` (narrative) + `reflection.patch` (multi-target unified diff: CLAUDE.md, /workflow skill files, dependency skills, project docs) + `reflection-watchlist.md` (cross-run pattern tracker, expires after K=3 unconfirmed runs). User reviews + `git apply` to accept; NEVER auto-applies (meta-level reasoning is least-validated, no auto-feedback loop without human gate). Tool whitelist Read,Glob,Grep,Bash,Write. Compounding mechanism: every accepted patch makes next run cheaper / more accurate / less interruptive — the workflow becomes user's leverage over time.
- 2026-05-28 — Q-phase10 — Phase 10 Summary = light end-of-run human-readable artifact (request / built / iterations / findings breakdown / escalations / status). Reads state.md + all iter-*/. Mechanical. Tool whitelist Read,Glob,Grep,Bash,Write.
- 2026-05-28 — Q-deploy — Kit convention: skill vendored at `.apm/skills/workflow/`, preset at `presets/workflow.yaml`. Coexists with `/feature-loop`. Workflow preset declares: workflow, e2e-validate, improve-codebase-architecture, improve-DDD-architecture, design-critique, diagnose, electron-visual-loop, web-visual-loop + plugins ui-ux-pro-max, frontend-design. code-review plugin NOT a workflow dependency (Q-phase6).
- 2026-05-28 — Q-review-fix-A — Phase 6 parallel fan-out must be implemented in `orchestrator.sh::dispatch()`, not delegated to the hook. Branch on `$phase -eq 6` → three concurrent `claude -p` invocations (arch / ddd / general) via `&` + `wait`. Production hook is a single `claude` binary; the fan-out is the orchestrator's responsibility.
- 2026-05-28 — Q-review-fix-B — STRENGTHENED Q-state-machine: only one phase runs at a time. Selection rule prepends **tag-priority ordering** (to-plan → to-review-plan → to-design → to-implement → code-complete-needs-verification → to-code-review → to-triage → to-design-critique), THEN emitted-by-phase, THEN item ID. A phase's tag must drain fully before lower-priority tags dispatch. Phase 6 is the sole intra-phase parallel case (three reviewers).
- 2026-05-28 — Q-review-fix-B1 — Phase 4 is BULK: one Phase 4 dispatch implements ALL pending `to-implement` items and emits ONE `code-complete-needs-verification` covering the un-skipped items. Per-item skip declarations still allowed; if every item carries `no-verification-needed`, no Cc-Nv emission at all. Eliminates per-chunk validation overlap.
- 2026-05-28 — Q-review-fix-C — Resume after escalation universally routes to `emitted-by-phase`. Drop hardcoded `HUMAN→2` / `DECISION→4` mappings. The phase that emitted the escalation is the phase that consumes the user's `--user-prompt` resolution. Crash recovery (hard kill mid-Phase 4) handled separately via invariant 5.11 — orchestrator reverts `in-progress → pending` on startup; no user prompt needed.
- 2026-05-28 — Q-review-fix-D — DISSOLVE the iteration counter. Replace with `.workflow/<ISO-timestamp>/` batch directories (one per Phase 4 dispatch). `meta.iteration` field removed from schema. Self-bail agents read prior batches sorted by mtime. Simpler than (emitted-by-phase, parent) tuple counting; no inflation risk.
- 2026-05-28 — Q-review-fix-E — Phase 6 emits ONLY `to-triage`. Phase 7 emits `to-design-critique` on its FINAL run (zero AUTO_APPLY this dispatch) AND `ui_work=true`. Guarantees Phase 8 evaluates post-triage stable code, not pre-triage code that Phase 7-driven Phase 4 may rewrite.
- 2026-05-28 — Q-review-fix-G — Lock file changed to atomic-mkdir directory at `.workflow/.lock/` (PID at `.lock/pid`). `mkdir` is atomic on POSIX; eliminates check-then-write TOCTOU race.
