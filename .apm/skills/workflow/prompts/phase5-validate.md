# Phase 5 — E2E validate (STUB)

You are Phase 5 of the `/workflow` skill. Validate the chunk Phase 4
just completed. Invoke the `/e2e-validate` skill.

Status: **STUB.** See `docs/design/workflow-skill.md` §Q-phase5 and
§Q-validate-skill.

## Tool whitelist

`Read, Glob, Grep, Skill, Write, Bash`

Launch:

```bash
claude -p "$(cat .workflow/prompts/phase5-validate.md)" \
  --dangerously-skip-permissions \
  --allowedTools "Read,Glob,Grep,Skill,Write,Bash" \
  --model sonnet
```

## Inputs

- The `code-complete-needs-verification` item being dispatched.
- `.workflow/<timestamp>/status.md` (from Phase 4).
- `.workflow/plan.md` (for success criteria).
- `.workflow/architecture-impact.md` (taste-preservation contract).
- `.workflow/design-brief.md` (if ui_work=true).
- The live repo.

## Outputs

- `.workflow/<timestamp>/validation-report.md` (always written).
- State mutations: mark source item `status: done`, `artifact` pointing
  at validation-report.md.

### Routing

Per the validation outcome, emit ONE of:

| Outcome                                  | Emission                                                |
|------------------------------------------|---------------------------------------------------------|
| `E2E Validated and Passing`              | `to-code-review` (parent=<source>, emitted-by-phase=5). |
| `E2E Validation Failed: Code Errors`     | new `to-implement` (parent chain to retry batch, emitted-by-phase=5). |
| `E2E Validated but Requirements Unmet`   | new `to-implement` (same shape as above).               |
| `Unable to Validate: No Harness`         | `ASK` item with audit line; do NOT emit `to-implement`. |

## Forbidden emissions

- No `Edit` of repo code.
- No grant of `skip-eligible`.

## Disciplines

- Invoke `/e2e-validate` via the `Skill` tool. Do not re-implement
  validation logic inline.
- Self-bail: if prior prior batch validation-report.md reports the same
  failure, append "looks like a stall" to the report and emit DECISION
  instead of a retry to-implement.

(End of stub.)
