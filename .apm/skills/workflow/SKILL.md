---
description: Cybernetic, self-improving feature-build loop. Bash orchestrator dispatches fresh Sonnet subprocesses per phase via a tagged work-item queue on disk. Use when the user says "/workflow <text>", asks to start an architecture-aware build, or resumes a paused workflow with new resolution context. Coexists with /feature-loop — use /feature-loop for simple work, /workflow when architecture awareness or self-improvement matter.
allowed-tools: Bash, Read, Write, Glob, Grep
added_in: 0.14.0
---

# /workflow

Architecture-aware, self-improving feature-build loop. The user invokes
`/workflow <free-text>` and the rest is the loop's job.

This skill is **structurally different** from `/feature-loop`:

- The runtime is a bash orchestrator at
  [orchestrator.sh](orchestrator.sh), not Claude reading SKILL.md as
  protocol.
- State lives on disk in `<repo>/.workflow/state.md` (see
  [state-template.md](state-template.md)).
- Each phase is a fresh `claude -p` subprocess with a tight
  `--allowedTools` whitelist (see the per-phase prompts in
  [prompts/](prompts/)).
- The formal contract is in
  [docs/design/workflow-state-machine.md](../../../docs/design/workflow-state-machine.md);
  the design rationale + decision log lives in
  [docs/design/workflow-skill.md](../../../docs/design/workflow-skill.md).

## How to invoke

Single entrypoint. Detection is mode-aware:

```
/workflow build a dark-mode toggle in settings
```

| State on disk                                       | What happens                                                      |
|-----------------------------------------------------|-------------------------------------------------------------------|
| No `.workflow/state.md`                             | Bootstrap: write a `to-plan` item with the user's text; loop.    |
| Pending actionable items, no escalations            | Resume: dispatch the next item per the selection rule.           |
| Only ASK / HUMAN / DECISION items                   | Resolution-resume: treat user text as `--user-prompt` for the owning phase. |
| All `done` + Phase 9–11 completed                   | Print summary; refuse to re-run unless the user opts in.         |

The orchestrator exits with:

- `0` — workflow complete
- `10` — paused on escalations; rerun `/workflow <resolution text>` to continue
- `2/3/4/5` — refused (bad args, invalid state, lock held, dispatch error)

## What the assistant does on `/workflow ...`

The slash command resolves to this skill. The assistant should:

1. Confirm the working tree has no uncommitted user changes the loop
   would overwrite (the loop writes to `.workflow/`, and Phase 4 will
   commit code changes — surprises here are user-visible).
2. Decide whether this invocation is **fresh**, **resume**, or
   **resolution-resume** by inspecting `.workflow/state.md` (or its
   absence).
3. Invoke the orchestrator:

   ```bash
   bash .apm/skills/workflow/orchestrator.sh \
     --workdir .workflow \
     [--user-request "$TEXT"] \
     [--user-prompt  "$TEXT"]
   ```

4. After the orchestrator exits, surface the relevant artifact:
   - exit 0 → `cat .workflow/summary.md`
   - exit 10 → list escalated items (`ASK` / `HUMAN` / `DECISION`)
     with the audit references the user must address.
   - exit 3 → print the validation error and the state path. Do not
     auto-recover — the user decides.

5. Do not retry the orchestrator on a non-zero exit without user
   direction. Surface the failure; the loop's design is deterministic
   and recoverable, but the recovery decision is the user's.

## Top-level disciplines (apply to every phase prompt)

These appear in each phase prompt template under `prompts/`. Repeated
here so the user can audit them in one place.

### Research delegation rule

- **SMALL** research (one source) is inline. Cite the URL in the
  calling artifact.
- **SIZABLE** research (multi-source synthesis, "is X still
  maintained" with uncertain answer) is delegated: the phase agent
  appends a `- [ ] Research: <topic> → .workflow/research/<slug>.md`
  item to plan.md and spawns a research sub-agent. No inline bailout.

### Escalation discipline

Before flagging anything for human resolution, the phase agent MUST
check (in order):

- `~/.claude/CLAUDE.md` (global user rules)
- `<repo>/CLAUDE.md` (project rules)
- `<repo>/CONTEXT.md` (domain glossary, if present)
- `<repo>/docs/adr/` (architecture decision records, if present)
- `<repo>/docs/` (DESIGN.md, ARCHITECTURE.md, etc.)
- All prior Phase 1 artifacts in `.workflow/`

Every escalation must record a `checked against: <docs>; not found`
audit line in the artifact the state item points to.

### No-narrative input discipline (Phase 7, Phase 8)

Triagers and design critics do NOT read implementer narratives or
chain-of-thought. They reason from review findings + Phase 1 artifacts
+ project docs. This is the load-bearing constraint preserving
separate-context judgment.

### Tag emission rules (orchestrator-enforced)

- `skip-eligible` permission may appear ONLY on items whose
  `emitted-by-phase ∈ {7, 8}`.
- `no-verification-needed` / `no-review-needed` skip tags may appear
  ONLY on `done` items whose `permissions` contains `skip-eligible`.
- The orchestrator rejects state files that violate either rule (exit
  3, state left untouched).

## Files

```
.apm/skills/workflow/
├── SKILL.md                ← this file
├── orchestrator.sh         ← bash dispatch loop
├── state-template.md       ← state file schema
├── lib/
│   └── state-ops.sh        ← shared bash helpers (parsing + validation)
└── prompts/
    ├── phase1-plan.md
    ├── phase2-plan-review.md
    ├── phase3-design.md
    ├── phase4-implement.md
    ├── phase5-validate.md
    ├── phase6-arch.md
    ├── phase6-ddd.md
    ├── phase6-general.md
    ├── phase7-triage.md
    ├── phase8-design-critique.md
    ├── phase9-documentation.md
    ├── phase10-summary.md
    └── phase11-reflection.md
```

State per-run lives in the host repo at `<repo>/.workflow/`. Add
`.workflow/` to `.gitignore` if you do not want loop artifacts in
version control. Some teams commit it deliberately to audit
reflection patches across runs — that is the user's call.

## Dependencies

Shipped via [`presets/workflow.yaml`](../../../presets/workflow.yaml):

- Skills: `e2e-validate`, `improve-codebase-architecture`,
  `improve-DDD-architecture`, `design-critique`, `diagnose`,
  `electron-visual-loop`, `web-visual-loop`.
- Plugins: `ui-ux-pro-max`, `frontend-design`.

`code-review` plugin is NOT a `/workflow` dependency (it is PR-required;
Phase 6 runs mid-loop with no PR).

## Status

MVP, feature-complete. The orchestrator, state-machine model, test
suite (15 cases / 183 asserts), all 13 phase prompts, the production
dispatch wrapper ([lib/dispatch-claude.sh](lib/dispatch-claude.sh)),
and both dependency skills (`e2e-validate`, `improve-DDD-architecture`)
are in place. See [docs/design/workflow-skill.md](../../../docs/design/workflow-skill.md)
for the per-phase locked decisions the prompts implement.

Outstanding: the loop has not yet been dogfooded on a real end-to-end
build against live `claude -p` subprocesses — that is the natural next
validation step.
