# Changelog

All notable changes to this package.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.2.0] - 2026-05-08

### Added

- **`plugins` primitive type** for Claude Code plugin marketplace integration. Plugins are declared as `.apm/plugins/<name>.plugin.md` with frontmatter pointing at a marketplace + plugin name. Wizard's customize step shows them; deploy step runs `claude plugin marketplace add <source>` + `claude plugin install <name>@<marketplace> --scope user`.
- **superpowers plugin** added to the `personal` preset (from `claude-plugins-official`, the official Anthropic marketplace; auto-updates at Claude Code startup).
- **`agent-kit update` plugin refresh**: tracked plugins are explicitly updated via `claude plugin update <name>@<marketplace>` during `update --content-only` and `update --adopt-preset-defaults`.
- **Verification of plugin install state** in `lib/verify.js` — checks `~/.claude/plugins/installed_plugins.json` for each tracked plugin name.
- **Claude Code CLI in the Docker test image** so the matrix can exercise real `claude plugin install` end-to-end.
- **Plugin assertions** in `claude-repo` and `claude-global` test cases — verify `~/.claude/plugins/installed_plugins.json` references `superpowers`.

### Changed

- All four presets gain a `plugins:` field (default `[]`; only `personal` ships with `[superpowers]`).
- Update test cases now explicitly set the kit to `0.0.1` before init, then bump to `0.2.0` before update — ensures the version-bump-detection logic actually triggers (was silent no-ops once the kit hit `0.2.0` itself).

### Notes on scope

Plugins always install at **user scope** in v0.2 regardless of the wizard's `--scope` choice. Rationale: superpowers is a personal-style preference, and Claude Code's user-scope plugin model is what the rest of the docs assume. Per-repo (project/local) plugin scopes are deferred to a later version.

### Review fixes (incorporated from multi-agent review on v0.2 increment)

- Update flow now mirrors deploy/verify and gates plugin refresh on `state.selected_agents.includes("claude")` — fixes a Codex-only repo invoking `claude plugin update` in a no-op loop.
- State (`.agent-kit.yaml`) only persists plugins that **actually installed successfully**. Failed installs are dropped so a future `agent-kit update` retries them.
- `claude plugin marketplace add` exit status is checked; non-zero skips the subsequent install with a clear error.
- Plugin frontmatter values (`marketplace_source`, `marketplace_name`, `plugin_name`) are validated against a strict regex before reaching `spawnSync` — blocks shell injection from a hostile kit on Windows where `shell:true` is needed for `.cmd` shim discovery.

### Deferred (acknowledged in review, not blocking v0.2)

- Add `plugins` to `claude.supports.primitiveTypes` in `lib/agents.js` so verify can route through the per-agent table (currently a separate branch — works but fragile to refactors).
- Log `kitRef` resolution in deploy.js so a hostile `AGENT_KIT_REF` env var is surfaced.
- Detect non-TTY in deploy.js and document/handle the `claude plugin marketplace add` trust prompt that may block on first use.
- Tighten `verify.js` substring match to a key-aware lookup (currently `json.includes('"name"')`).
- Tests mutate `$KIT_ROOT/package.json` in place — copy to `$WORK` for cleaner isolation.

## [0.1.0] - 2026-05-08

### Added

- Interactive wizard `agent-kit init` (5-step) and `agent-kit update` (3-step), driven by `@clack/prompts`.
- Non-interactive flags for both commands (CI-friendly): `--preset`, `--agents`, `--scope`, `--primitives`, `--codex-personal-layer`, `--yes`, `--content-only`, `--adopt-preset-defaults`, `--dry-run`.
- 4 presets: `personal`, `microsoft` (extends personal; placeholder for v0.1), `minimal`, `none`.
- 2 instruction primitives + 6 prompt primitives migrated from `superliaye/personal-agent-kit`, with `description` / `applyTo` / `added_in: 0.1.0` frontmatter.
- Docker-based test matrix: 6 cases (Claude × {repo, global}, Codex × {repo, global}, two update flows). All green.
- Bootstrap script (`bootstrap.sh`) and PATH-installable launcher (`bin/agent-kit`).
- State tracking via `.agent-kit.yaml` per repo (preset, kit version, agents, scope, primitives snapshot).
- Codex global copy step (`~/.apm/AGENTS.md` → `~/.codex/AGENTS.md`) — APM gap-plug.
- Codex personal layer (`AGENTS.override.md` + `.gitignore`) for repo-scope Codex installs.
- `AGENT_KIT_REF` env var to override the default GitHub install reference (used by tests; can be used for local kit development).

### Changed

- Folded `superliaye/personal-agent-kit` primitives in. That repo will be archived once this is operational.
