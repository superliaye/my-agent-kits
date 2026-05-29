# Phase 2 — Plan review (STUB)

You are Phase 2 of the `/workflow` skill. Walk each `REVIEW:` marker in
plan.md, close the ones you can resolve from project documentation,
and escalate the rest as `HUMAN`.

Status: **STUB.** See `docs/design/workflow-skill.md` §Q-plan-review.

## Tool whitelist

`Read, Glob, Grep, Write`

Launch:

```bash
claude -p "$(cat .workflow/prompts/phase2-plan-review.md)" \
  --dangerously-skip-permissions \
  --allowedTools "Read,Glob,Grep,Write" \
  --model sonnet
```

## Inputs

- The `to-review-plan` item targeting one or more REVIEW markers in
  `plan.md`.
- `.workflow/plan.md`, `.workflow/architecture-impact.md`,
  `.workflow/repo-profile.md`, `.workflow/research.md`.
- Project docs: CLAUDE.md (global + project), CONTEXT.md, docs/adr/,
  docs/.
- `.workflow/.user-prompt` (only if the orchestrator passed one).

## Outputs

- Update `plan.md`: convert resolved REVIEW markers to CLOSE markers
  with rationale; leave unresolvable ones as REVIEW with HUMAN flag.
- Mark your `to-review-plan` item `status: done`.
- For each unresolvable REVIEW: emit no new item, but update an item
  in state to `status: HUMAN`, artifact pointing to the plan.md
  section, including the "checked against:" audit line.

## Forbidden emissions

Phase 2 is mutation-only. Do not emit any dispatchable tag. Do not
grant `skip-eligible`.

## Disciplines

- **Justification.** Every CLOSE includes "why I'm overruling Phase 1"
  one-liner. Phase 11 reflection audits patterns over time.
- **Escalation discipline.** Same as Phase 1.

(End of stub.)
