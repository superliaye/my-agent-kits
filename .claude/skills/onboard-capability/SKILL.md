---
name: onboard-capability
description: Walk through adding a new capability (instruction / skill / plugin / bundle / hook / mcp) to my-agent-kits — picks the right type, creates the file with correct frontmatter, optionally wires it into a preset, drops in a test case, and bumps version + CHANGELOG. Use when adding new content to this kit; do NOT use for capabilities that are already deployed by `agent-kit init` in consumer repos.
---

# Onboard a new capability

## 1. Pick the type

| You want to add… | Capability type | Lives at | Reaches consumers as |
| --- | --- | --- | --- |
| A repo-agnostic rule concatenated into `CLAUDE.md` / `AGENTS.md` | `instruction` | `capabilities/instructions/<name>.instructions.md` | Block in `CLAUDE.md` / `AGENTS.md` |
| A multi-step workflow + optional slash command | `skill` | `capabilities/skills/<name>/SKILL.md` (folder) | `~/.claude/skills/<name>/` (and `~/.agents/skills/<name>/` for Codex, with a manual-only `agents/openai.yaml` sidecar) |
| A Claude Code marketplace plugin pointer | `plugin` | `capabilities/plugins/<name>.plugin.md` | `claude plugin install` (user scope) |
| A wrapper around an external installer (e.g. gstack, hyperframes) | `bundle` | `capabilities/bundles/<name>.bundle.md` | Installed by upstream installer; symlinked or copied into `~/.claude/skills/` |
| A hook script | `hook` | `capabilities/hooks/<name>.sh` | (Wiring is TODO — verify before relying) |
| An MCP server config | `mcp` | `capabilities/mcp/<name>.yaml` | (Wiring is TODO — verify before relying) |

If you're not sure, default to **skill** — that's the type with the most coverage.

## 2. Create the file

Copy the nearest neighbor of the same type. Don't write frontmatter from scratch:

- **Instruction:** copy `capabilities/instructions/core.instructions.md` — note `description`, `applyTo`, `added_in`.
- **Skill:** copy any `capabilities/skills/<existing>/SKILL.md`. Required frontmatter: `name`, `description`. Set `disable-model-invocation: true` if it should be slash-only (no model auto-invocation).
- **Plugin:** copy `capabilities/plugins/<existing>.plugin.md` — needs `marketplace_source`, `marketplace_name`, `plugin_name`.
- **Bundle (setup-script kind):** copy `capabilities/bundles/gstack.bundle.md`. Fields: `source`, `pinned_commit` (40-char SHA), `installer.command`, `installer.flags`, `host_flag_map`, `requires`, `verify_paths`.
- **Bundle (npx-skills kind):** copy `capabilities/bundles/hyperframes.bundle.md`. Fields: `installer.kind: npx-skills`, `installer.package`, `requires`, `verify_paths`. The upstream `skills` CLI does the host-aware install; we just pass `--agent` and `--skill '*'`.

**Always set** `added_in: <next-kit-version>` in the new capability's frontmatter — it records which kit version the capability shipped in. (Metadata only: `agent-kit update` is a stateless global re-deploy with no per-repo delta detection, so it does not read `added_in` to surface "new in preset.")

**Unshipped assets (skills only):** if a skill folder carries heavy provenance/reproducibility files (evidence reports, source corpora) that an agent does NOT need at use-time, put them in an `_unshipped/` subdirectory inside the skill folder. `deploy.js` excludes any `_unshipped/` segment from the recursive copy, so those files stay in the kit repo but never bloat a consumer install. Point the SKILL.md/README references at `_unshipped/<file>` and note they aren't bundled into deployed installs.

## 3. Optionally wire into a preset

If the capability should ship by default with a preset, add its name to that preset's `capabilities.<type>` array:

```yaml
# presets/<name>.yaml
capabilities:
  skills:
    - my-new-skill        # ships with this preset; users get it on the next `agent-kit init`/`update`
```

Omit the preset edit if the capability is opt-in only (via `--capabilities '+name'`).

## 4. Add a test case

Mirror the closest existing test in `test/cases/`. Naming matches the capability:

- **Skill:** mirror `test/cases/claude-repo.sh` — assert the skill folder lands in `.claude/skills/<name>/` and a representative file (e.g. `SKILL.md`) exists.
- **Bundle (setup-script):** mirror `test/cases/gstack-bundle.sh` — set `AGENT_KIT_SKIP_BUNDLE_INSTALL=1` and assert state captures the bundle + pinned commit.
- **Bundle (npx-skills):** mirror `test/cases/hyperframes-bundle.sh` — same skip-install pattern; assert state captures `bundle_commits.<name>: <package-spec>`.
- **Instruction:** mirror `test/cases/claude-md-concat.sh` — assert the rule body shows up in `CLAUDE.md`.
- **Plugin:** mirror an existing plugin test if one exists; otherwise an assert on the state file's `plugins:` list is the minimum.

The test runner is `npm test` (builds + runs Docker — isolated, doesn't touch your host's `~/.claude/`). For faster inner-loop iteration use `npm run test:host` — that mode writes to your real `$HOME/.claude/` and `$HOME/.codex/`, so only use it when you know what you're doing.

## 5. Bump version + CHANGELOG

For a feature add, this is **minor** (e.g. `0.8.0` → `0.9.0`). For a fix only, **patch** (`0.8.0` → `0.8.1`).

1. **`package.json`** — bump `version`, then run `npm install --package-lock-only` to sync `package-lock.json`'s `version` field. Skipping this leaves the lockfile stale, so the first `npm install` after any clone (e.g. `bootstrap.sh` during `agent-kit init`) rewrites it and produces a spurious diff.
2. **`CHANGELOG.md`** — add a new top section under `## [X.Y.Z] - YYYY-MM-DD` with `### Added` / `### Changed` / `### Removed` sub-sections per [Keep a Changelog](https://keepachangelog.com). Lead with what *changed for consumers*, not internal refactors.
3. **`added_in:`** in the new capability's frontmatter must match the version you're bumping to (step 1) so the frontmatter records which kit version it shipped in. It is metadata only — `agent-kit update` re-deploys the whole resolved working set and does not read `added_in` for any delta.

## 6. Verify

```bash
npm test            # Docker (default)
npm run test:host   # this machine — touches real ~/.claude/
```

Expected: full pass in Docker. Host mode passes the same case set when `~/.claude/` is in a clean enough state — but cases can trip on pre-existing global artifacts (e.g. `~/.claude/rules/`).

## 7. Commit

One commit. Suggested subject:

- New capability in a preset: `feat(vX.Y.Z): add <name> <type> to <preset> preset`
- New capability opt-in only: `feat(vX.Y.Z): add <name> <type> (opt-in via --capabilities)`
- Bundle: `feat(vX.Y.Z): add <name> bundle (<setup-script|npx-skills>)`

## Notes

- **Don't add docs files (`*.md`) outside `capabilities/` or `docs/`** unless the user asks — per repo CLAUDE.md.
- **Don't put kit-maintainer skills in `capabilities/skills/`** — they'd deploy to consumer repos. Put them in `.claude/skills/<name>/` (this file's home, alongside this `onboard-capability` skill).
- **Naming**: pick a name unique within `capabilities/<your-type>/`. Cross-type duplicates (e.g. both `capabilities/skills/foo/` and `capabilities/instructions/foo.instructions.md`) are technically allowed by the kit but confusing — avoid unless intentional.
