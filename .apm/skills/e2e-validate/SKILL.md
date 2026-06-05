---
description: Stack-aware end-to-end validation. Discovers the repo's test/build harness, runs the closest smoke recipe, and verifies a change against declared success criteria — including UI feature visibility via screenshots. Use when verifying that code changes actually run and fulfill their requirements, or when the user asks to validate/smoke-test a change. Invoked by /build-feature-workflow Phase 5 and Phase 8, and usable standalone.
added_in: 0.14.0
---

# e2e-validate

Validate that a change **runs** and **fulfills its success criteria** —
not just that it compiles. Discover the real harness; never invent
commands. When no harness fits the change kind, that is a reportable
finding, not a silent pass.

## Interface

Caller passes (via the invoking prompt):

- `mode` — `chunk` (validate a specific change) or `full-repo`.
- `changed_files` — paths in scope (when `mode=chunk`).
- `success_criteria` — what "done" means for this change.
- `ui_work` — `true` if a UI surface must be visually verified.
- `stack` — TypeScript / React / Vite / Next / Electron / backend API /
  static HTML, if known.

Returns:

- `status` — one of the enum values in **Status** below.
- `report` — commands run, output excerpts, screenshot paths, and the
  specific reason for the status.

## Process

1. **Discover the harness — do not invent commands.** Read
   `package.json` scripts, `Cargo.toml`, `Makefile`, CI config
   (`.github/workflows`), and `CLAUDE.md`. Use what exists.
2. **Pick the smoke recipe** by stack (see Recipes).
3. **Run it.** Capture output.
4. **Run the project's format/lint check on the changed files.** Discover
   it the same way as the harness — the lint/format script in
   `package.json` (`biome`, `eslint`, `prettier`), or `ruff`/`gofmt`/etc.
   A non-zero result is `Code Errors`, not a pass, even if tests are
   green. On Windows, distinguish a real content failure from a
   line-ending-only blob difference (`git ls-files --eol`, or check the
   staged/index content) so you don't chase CRLF noise. If the repo has
   no lint/format tool, skip — don't invent one.
5. **If `ui_work`,** capture a screenshot and verify each
   success-criterion feature is actually visible (e.g. "dark-mode
   toggle present in settings").
6. **Judge against `success_criteria`,** not just exit codes. Code that
   runs but doesn't meet the criteria is `Requirements Unmet`.
7. **Route stubborn failures to `/diagnose`** if it's installed and the
   failure's root cause isn't obvious.
8. **Write the report** with the status and evidence.

## Status (the routing signal)

| Status | Meaning |
|---|---|
| `E2E Validated and Passing` | Harness ran clean AND success criteria met. |
| `E2E Validation Failed: Code Errors` | Tests fail, build broke, or runtime errored. |
| `E2E Validated but Requirements Unmet` | Runs fine, but doesn't fulfill the success criteria. |
| `Unable to Validate: No Harness` | No test runner and no smoke recipe fits — escalate; re-implementing won't add a harness. |

The status is a routing signal; the detailed reasons live in the
report. Always write an informative report regardless of status.

## Recipes (smoke fallbacks when there's no first-class test suite)

See per-stack detail in [recipes/](recipes/).

- **Static HTML/CSS/JS** — `node --check` on JS; parse HTML and
  regex-assert critical IDs / aria attributes / script tags.
  ([recipes/static-html.md](recipes/static-html.md))
- **Node / TS, no tests** — `node --check`, `npx tsc --noEmit`,
  smoke-`require`/`import` the entry point.
  ([recipes/ts-node.md](recipes/ts-node.md))
- **Vite / Next / SPA, no tests** — `npm run build`; boot the dev
  server and `curl -fsS /` for a non-5xx; `web-visual-loop` screenshot
  if installed. ([recipes/vite-spa.md](recipes/vite-spa.md))
- **Electron, no tests** — build; `electron-visual-loop` screenshot +
  element-existence check. ([recipes/electron.md](recipes/electron.md))
- **Backend API, no tests** — `curl -fsS` representative inputs; DB
  migrations dry-run. ([recipes/backend-api.md](recipes/backend-api.md))
- **None fit** — the `Unable to Validate: No Harness` finding, with a
  concrete remediation suggestion (e.g. "add `tests/toggle.test.ts`
  covering [behavior]"), is the minimum delivery.

## Discipline

- **Missing harness is a finding, never a silent skip.** Always emit a
  concrete remediation suggestion with the no-harness status.
- **Lint/format failures in the changed diff are `Code Errors`.** A green
  test run over a lint-failing diff is not validated — surface it so the
  caller fixes it before shipping.
- **Don't invent commands.** If `npm test` isn't a real script, don't
  run it. Discover first.
- **UI claims need pixels.** For `ui_work`, a screenshot showing the
  feature is the evidence — not "the code looks right."
