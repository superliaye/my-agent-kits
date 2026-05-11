# Source

Vendored from an upstream repo. To sync with upstream, follow the steps below.

## Upstream

- **Repo**: https://github.com/mattpocock/skills
- **Path**: `skills/engineering/improve-codebase-architecture/`
- **Last synced**: 2026-05-11 (vendored at `upstream_version: 1.0.0`)
- **Files vendored**:
  - `SKILL.md`
  - `LANGUAGE.md`
  - `INTERFACE-DESIGN.md`
  - `DEEPENING.md`

## Re-sync procedure

1. Fetch the upstream files at the path above.
2. Diff against the current vendored copy.
3. Replay any local modifications (see below) on top of the new content.
4. Bump `upstream_version` in `SKILL.md` frontmatter and `Last synced` above.
5. Bump `package.json` version and `added_in` in `SKILL.md` if the content materially changed.

## Local modifications

- Dropped upstream's `name: improve-codebase-architecture` field — the kit's primitive loader derives the name from the folder.
- Added kit-required fields: `disable-model-invocation: true`, `added_in`, `upstream`, `upstream_version`.

## Cross-skill dependencies

`SKILL.md` references two files in the sibling skill `grill-with-docs` via relative paths:

- `../grill-with-docs/CONTEXT-FORMAT.md`
- `../grill-with-docs/ADR-FORMAT.md`

These resolve correctly in both the kit layout (`.apm/skills/*/`) and the deployed layout (`.claude/skills/*/` or `.agents/skills/*/`) — both are sibling folders. **If `grill-with-docs` is removed from a preset, those references break**; keep them together.

## Notes

- Manual-only (`disable-model-invocation: true`) — matches the diagnose skill. This is a deliberate architectural review tool, not something to auto-invoke on every "improve this" mention.
- `diagnose`'s Phase 6 hands off to this skill — pairs naturally with it.
