# Recipe — Vite / Next / SPA (no first-class test suite)

1. **Build** — run the project's real build script (`npm run build` /
   `next build` / `vite build`, discovered from `package.json`). A
   broken build is `E2E Validation Failed: Code Errors`.
2. **Boot + probe** — start the dev/preview server in the background,
   wait for the port, then `curl -fsS http://localhost:<port>/`. A 5xx
   or connection failure is a code error. Tear the server down after.
3. **Visual verify (if `ui_work`)** — invoke `web-visual-loop` if
   installed: navigate to the changed route, screenshot, and confirm
   each success-criterion element is present and visible.
4. **Run real tests if they exist** — Playwright / Vitest / Cypress,
   discovered from `package.json`.

## Status mapping

- Build break / 5xx / server won't boot → `E2E Validation Failed: Code
  Errors`.
- Builds + boots, but the feature isn't visible in the screenshot →
  `E2E Validated but Requirements Unmet`.
- No build script and no server entry → `Unable to Validate: No
  Harness`; suggest the smallest viable check to add.
