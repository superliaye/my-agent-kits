# Recipe — Node / TypeScript (no first-class test suite)

Order, cheapest signal first:

1. **Syntax check** — `node --check <entry>.js` for plain JS files in
   scope.
2. **Type check** — `npx tsc --noEmit` (only if `tsconfig.json`
   exists). Report the first errors verbatim; don't summarize away the
   file:line.
3. **Smoke import** — import/require the entry module in a throwaway
   script and assert it loads without throwing:
   `node -e "require('./dist/index.js')"` (or `import()` for ESM).
4. **Run real tests if they exist** — discover the script
   (`npm test`, `vitest`, `jest`) from `package.json`; run it. Never
   invent a test command.

## Status mapping

- tsc/test failures → `E2E Validation Failed: Code Errors`.
- Loads + types clean, but the success criterion (e.g. "exports
  `parseConfig`") isn't met → `E2E Validated but Requirements Unmet`.
- No tsconfig, no tests, no entry to smoke → `Unable to Validate: No
  Harness`; suggest adding a test file covering the changed behavior.
