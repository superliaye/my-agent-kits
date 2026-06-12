# Recipe — Static HTML / CSS / JS (no build, no tests)

1. **Syntax check JS** — `node --check` each changed `.js` file.
2. **Parse HTML** — load the changed HTML and regex-assert the critical
   structure the change was supposed to add: required element IDs,
   `aria-*` attributes, `<script>`/`<link>` tags, form fields.
3. **Open + eyeball (if `ui_work`)** — invoke `web-visual-loop` against
   the file (or a static server) and screenshot to confirm the
   success-criterion element renders.

## Status mapping

- JS syntax error / missing critical element → `E2E Validation Failed:
  Code Errors`.
- Parses, but the required attribute/element from the criteria is
  absent → `E2E Validated but Requirements Unmet`.
- Nothing assertable about the change → report what was checked and why
  it's thin; `Unable to Validate: No Harness` only if there is
  genuinely no signal to capture.
