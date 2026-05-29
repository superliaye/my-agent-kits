# Recipe — Backend API (no first-class test suite)

1. **Build / start** — compile if needed, then start the service (real
   start command from `package.json` / `Makefile` / `Procfile`). Boot
   failure is `E2E Validation Failed: Code Errors`.
2. **Probe representative endpoints** — `curl -fsS` the routes the
   change touches with representative inputs. Assert status codes and
   key response fields against the success criteria.
3. **DB migrations dry-run** — if the change includes migrations, run
   the migration tool's dry-run / `--check` mode. Never run destructive
   migrations against a real database to validate.
4. **Run real tests if they exist** — discovered from `package.json` /
   `Makefile` / `pytest`/`go test` config.

## Status mapping

- Boot failure / 5xx / migration error → `E2E Validation Failed: Code
  Errors`.
- Service runs, but the endpoint's behavior doesn't meet the criteria
  → `E2E Validated but Requirements Unmet`.
- No way to start the service and no tests → `Unable to Validate: No
  Harness`; suggest the smallest integration test to add.
