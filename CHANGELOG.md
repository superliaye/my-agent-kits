# Changelog

All notable changes to this package.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.8.0] - 2026-05-13

### Added

- **`productivity` preset** ([presets/productivity.yaml](presets/productivity.yaml)) — standalone preset containing `core` (instruction), `grill-me` (skill), and `hyperframes` (bundle). Use for repos that want only planning + video tooling without the full engineering skill set.
- **`hyperframes` bundle** ([.apm/bundles/hyperframes.bundle.md](.apm/bundles/hyperframes.bundle.md)) — wraps [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes), an HTML-native video rendering framework for AI agents. Installs `/hyperframes`, `/hyperframes-cli`, `/hyperframes-media`, `/hyperframes-registry`, plus animation runtime skills (`/gsap`, `/animejs`, `/css-animations`, `/lottie`, `/three`, `/waapi`). Requires Node ≥ 22 and FFmpeg on PATH (FFmpeg checked at render time, not install).
- **`installer.kind: npx-skills` bundle flavor** — second installer kind alongside the existing `setup-script` (gstack pattern). Bundles using `npx-skills` declare a single `installer.package` field (e.g. `heygen-com/hyperframes` or `heygen-com/hyperframes@1.2.3`) instead of `source` + `pinned_commit`. The wizard invokes `npx -y skills add <package>` once — the upstream `skills` CLI is host-aware and writes to each detected agent's skills dir itself, so no `host_flag_map` / per-agent loop is needed. State persists the package spec verbatim in `bundle_commits.<name>` for drift detection on `agent-kit update`.
- **Multi-preset selection** — `agent-kit init --preset engineering,productivity` now accepts a comma-separated list. The wizard merges the primitives of every named preset (union, deduped per type) before deploying. Interactive form uses a `multiselect` prompt (must pick at least one). State persists the joined name (`engineering+productivity`) in `.agent-kit.yaml`, and `agent-kit update` round-trips it via `splitPresetNames()`.
- **`hyperframes-bundle` and `multi-preset` test cases** — mirror `gstack-bundle.sh`; assert state captures the `productivity` preset's npx-skills bundle and that multi-preset union/dedupe + state round-trip work end-to-end.

### Removed

- **`microsoft`, `minimal`, `personal` presets** — `microsoft` was an empty alias of `engineering` (v0.1 placeholder); `minimal` overlapped with `none`; `personal` was introduced earlier this release and consolidated into `productivity`. Remaining presets: `engineering`, `productivity`, `none`. Users on the removed presets should re-run `agent-kit init --preset {engineering|productivity|none}` to land on a supported one.

### Changed

- `lib/primitives.js`: bundle metadata reads `installer.kind` from frontmatter (default `setup-script`). Surfaces it as `item.installerKind` for `deploy.js`.
- `lib/deploy.js`: `deployBundle` now dispatches on `installer.kind`. The existing clone-and-run-setup path was refactored into `deploySetupScriptBundle`. New `deployNpxSkillsBundle` runs `npx -y skills add <package>` with a `NPM_CONFIG_REGISTRY` defaulted to the public registry (same fix as 0.7.1 for setup-script bundles).
- `lib/presets.js`: added `loadPresets(names)` for multi-preset merging and `splitPresetNames(field)` for state round-tripping. `loadPreset` now validates the name against `^[A-Za-z0-9][A-Za-z0-9_\-]*$` — `+` is reserved as the multi-preset join character.
- `lib/init.js`: `pickPreset` accepts a comma-separated `--preset` flag and uses `multiselect` interactively. Returns the merged preset directly.
- `lib/update.js`: loads the preset via `loadPresets(splitPresetNames(state.preset))` so multi-preset state files round-trip without breaking the v0.4 migration path.
- `lib/cli.js`: help text shows `--preset NAME[,NAME2]`.
- [docs/maintaining-bundles.md](docs/maintaining-bundles.md): documents the `installer.kind: npx-skills` flavor and when to choose each kind.

### Notes on installer kinds

| Kind | Pin mechanism | Best for |
| --- | --- | --- |
| `setup-script` (default) | 40-char git SHA on a public HTTPS git URL | Stateful installers that need a setup script, native binaries, or per-platform logic (e.g. gstack: bun-driven setup, Playwright Chromium install) |
| `npx-skills` | npm package spec (`pkg` or `pkg@version`) | Skill bundles already packaged for the `skills` CLI; no setup script, no extra runtime install (e.g. hyperframes) |

## [0.7.1] - 2026-05-12

### Fixed

- **Bundle installers now force `NPM_CONFIG_REGISTRY=https://registry.npmjs.org/`** for their subprocess unless the user has explicitly set one. Bundles vendor from public GitHub, so their dependency manifests expect public npm — users on Microsoft codespaces (whose `~/.npmrc` points at `onedrive.pkgs.visualstudio.com/_packaging/odsp-npm` requiring SSO) and other corporate-mirror setups hit 401s on every package fetch inside the installer's `bun install`. Override stays available for legitimate internal mirrors via `NPM_CONFIG_REGISTRY=... ./bin/agent-kit init`.

## [0.7.0] - 2026-05-12

### Added

- **`bundles` primitive type** — wraps external installers as single deployable primitives. Lives at `.apm/bundles/<name>.bundle.md`. Bundles always install to user-global locations (the upstream installers have no `--target` flag) and run once per selected agent via a `host_flag_map`. Frontmatter declares `source`, `pinned_commit`, `installer.command/flags`, `requires`, and `verify_paths`. The kit validates `source` (https git URL only) and `pinned_commit` (hex SHA only) before invoking `git clone`.
- **gstack bundle** ([.apm/bundles/gstack.bundle.md](.apm/bundles/gstack.bundle.md)) — pinned to commit `dc6252d`. Installs all 30+ gstack slash commands as `/gstack-*` prefixed via gstack's `--prefix` flag. Adds planning (`/gstack-office-hours`, `/gstack-autoplan`), build/QA (`/gstack-design-shotgun`, `/gstack-qa`, `/gstack-review`), ship (`/gstack-ship`), security (`/gstack-cso`), browser automation (`/gstack-browse`), and more. Opt-in via the post-scope wizard prompt or `--bundles gstack` in flag mode — no dedicated preset needed.
- **Auto-install of Bun** — gstack's setup requires Bun. The wizard's `pickBundles` step pre-flights and offers to install Bun via the official installer (`curl -fsSL https://bun.sh/install | bash` / Windows MSI). Interactive mode prompts; flag mode auto-installs silently.
- **`--bundles name1,name2` flag** in `agent-kit init` for non-interactive bundle selection. Pass `--bundles ''` to skip all bundles.
- **`bundle_commits:` field in `.agent-kit.yaml`** — records the commit each bundle was last successfully installed at. `agent-kit update` re-runs the installer when the kit's `pinned_commit:` drifts from this record.
- **`AGENT_KIT_SKIP_BUNDLE_INSTALL=1` env var** — skips clone + bun pre-flight + setup, records state as if installed. Used by the Docker test matrix to avoid downloading Chromium per CI run.
- **`gstack-bundle` test case** — verifies preset loads, bundle is recorded in state with the correct pin, engineering primitives still land, no gstack artifacts leak into the consumer repo.
- **[`docs/maintaining-bundles.md`](docs/maintaining-bundles.md)** — maintainer procedure for bumping upstream pins and adding new bundles.

### Changed

- `lib/primitives.js` `TYPE_LOCATIONS`: added `bundles` entry. `listAllPrimitives()` returns a `bundles` array with `source`, `pinnedCommit`, `scope`, `installer`, `requires`, `verifyPaths` parsed from frontmatter.
- `lib/presets.js` `PRIMITIVE_TYPES`: added `bundles`. All 4 existing presets gained `bundles: []`.
- `lib/init.js`: new `pickBundles` step after `pickScope`. Bundles are deliberately excluded from `pickPrimitives` so they appear as a focused yes/no question rather than buried in a long multiselect.
- `lib/deploy.js`: new `deployBundle` branch (step 4b). Pre-flights Bun, clones source at pin, runs installer per agent, persists commit to state. Helpers `bundlesNeedingBunInstall` and `ensureBunInstalledNow` exposed for init's pre-flight prompt.
- `lib/update.js`: type lists now include `bundles`. Commit drift is handled implicitly — `cloneOrUpdateBundleSource` is idempotent, so re-running update with a bumped `pinned_commit:` fetches and reinstalls.
- `lib/verify.js`: checks each bundle's `verify_paths.{agent}` exists and is non-empty. Skipped under `AGENT_KIT_SKIP_BUNDLE_INSTALL=1`.
- `lib/state.js`: persists `bundle_commits: { <name>: <sha>, ... }`.
- `lib/cli.js`: `--bundles` listed in help text.

### Notes on scope

Bundles ALWAYS install globally (`~/.claude/skills/<bundle>/`, `~/.codex/skills/<bundle>/`) regardless of the wizard's `--scope` choice, because the upstream installers don't accept a target directory. The rest of the kit still respects `--scope repo`; only the bundle install bypasses it. This is called out in the interactive prompt and the bundle's frontmatter `scope: global` field.

## [0.3.0] - 2026-05-11

### Breaking changes

- **`prompts` primitive type removed.** Slash-command-like reusable invocations now live as skills with `disable-model-invocation: true` in frontmatter. Aligns with the direction both Anthropic ([commands merged into skills](https://code.claude.com/docs/en/skills)) and OpenAI ([custom prompts deprecated in favor of skills](https://developers.openai.com/codex/custom-prompts)) have published. Authors write SKILL.md once; the kit handles per-vendor translation at deploy time.
- **`code-review` placeholder skill removed.** It was a stub from v0.1 to validate the skills code path; the 6 newly-migrated skills cover that ground.

### Added

- **karpathy instruction primitive** (`.apm/instructions/karpathy.instructions.md`) vendored from [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills) v1.0.0. Always-loaded behavioral guidelines from Karpathy's LLM-coding-pitfalls observations. Matches community usage (most adopt as CLAUDE.md content rather than as a plugin).
- **6 skills migrated from prompts**: `my-commit`, `my-commit-and-push`, `my-create-pr`, `my-explain`, `my-fix-build`, `my-clean-code`. Each authored in Claude format (frontmatter `disable-model-invocation: true`) so they behave as manual-only slash commands without polluting the model's context window.
- **`compileSkillsForCodex` step in `lib/deploy.js`**: when Codex is selected, walks the deployed `.agents/skills/<name>/` folders and emits `agents/openai.yaml` sidecar with `policy.allow_implicit_invocation: false` for every skill that has `disable-model-invocation: true`. One-way translation, kit-author writes Claude format only.
- **`codex-personal-isolation` test case**: verifies Codex-only runs (a) deliver instructions + skills, (b) generate Codex sidecars, (c) don't leak `.claude/` into the repo, (d) don't install Claude Code plugins.

### Changed

- All presets dropped `prompts:` field. `personal.yaml` skills list now contains the 6 migrated slash commands.
- `lib/agents.js`: Claude's `primitiveTypes` is now `["instructions", "skills"]` (was `["instructions", "prompts", "skills"]`); `paths.repo` and `paths.global` removed the `prompts` entry.
- `lib/primitives.js` `TYPE_LOCATIONS`: `prompts` entry deleted; updated comment to reflect v0.3 layout.
- `lib/presets.js` `PRIMITIVE_TYPES`: removed `"prompts"`.
- `lib/init.js`, `lib/update.js`: hardcoded primitive-type loops/skeletons updated to drop `prompts`.
- Test matrix grew from 6/24 to 7/36 — added the codex-personal-isolation case + skills-deployment assertions for both agents.

### Notes

This is a personal kit; semver is informal. Calling this 0.3.0 because dropping a primitive type IS a breaking change for anyone who was relying on `prompts` in their state file or preset config. In practice the only consumer (me) gets clean v0.3 layout via `agent-kit init` in fresh repos.

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
