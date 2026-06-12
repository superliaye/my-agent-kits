# Recipe — Electron (no first-class test suite)

1. **Build** — run the project's real build/package script (discovered
   from `package.json`). A broken build is `E2E Validation Failed: Code
   Errors`.
2. **Visual verify** — invoke `electron-visual-loop` (the preferred
   driver for desktop apps via CDP): launch the app, screenshot the
   changed surface, and assert the success-criterion elements exist in
   the renderer.
3. **Element-existence check** — confirm the specific DOM/role nodes the
   change was supposed to add are present (not just that the window
   opened).
4. **Run real tests if they exist** — Spectron / Playwright-electron,
   discovered from `package.json`.

## Status mapping

- Build break / app won't launch → `E2E Validation Failed: Code
  Errors`.
- Launches, but the expected element is absent → `E2E Validated but
  Requirements Unmet`.
- No build script and no way to launch headless → `Unable to Validate:
  No Harness`; recommend wiring `electron-visual-loop`.
