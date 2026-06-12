# Source

Vendored from an upstream repo. To sync with upstream, follow the steps below.

## Upstream

- **Repo**: <https://github.com/mattpocock/skills>
- **Path**: `skills/engineering/grill-with-docs/`
- **Last synced**: 2026-06-12 (vendored at upstream HEAD `694fa30`)
- **Files vendored**:
  - `SKILL.md`
  - `CONTEXT-FORMAT.md`
  - `ADR-FORMAT.md`

## Re-sync procedure

1. Fetch the upstream files at the path above.
2. Diff against the current vendored copy.
3. Replay any local modifications (see below) on top of the new content.
4. Bump `upstream_version` in `SKILL.md` frontmatter and `Last synced` above.
5. Bump `package.json` version and `added_in` in `SKILL.md` if the content materially changed.

## Local modifications

- Dropped upstream's `name: grill-with-docs` field — the kit's capability loader derives the name from the folder.
- Added kit-required fields: `added_in`, `upstream`, `upstream_version`.
- `disable-model-invocation` deliberately NOT set — this skill is model-invocable.
