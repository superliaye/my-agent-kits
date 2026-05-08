# Changelog

All notable changes to this package.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
