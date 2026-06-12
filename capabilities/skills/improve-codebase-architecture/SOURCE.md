# Source

Vendored from an upstream repo. To sync with upstream, follow the steps below.

## Upstream

- **Repo**: <https://github.com/mattpocock/skills>
- **Path**: `skills/engineering/improve-codebase-architecture/`
- **Last synced**: 2026-05-22 (vendored at `upstream_version: 1.1.0`, upstream HEAD `b8be62f`)
- **Files vendored**:
  - `SKILL.md`
  - `LANGUAGE.md`
  - `INTERFACE-DESIGN.md`
  - `DEEPENING.md`
  - `HTML-REPORT.md` (added in 1.1.0)

## Re-sync procedure

1. Fetch the upstream files at the path above.
2. Diff against the current vendored copy.
3. Replay any local modifications (see below) on top of the new content.
4. Bump `upstream_version` in `SKILL.md` frontmatter and `Last synced` above.
5. Bump `package.json` version and `added_in` in `SKILL.md` if the content materially changed.

## Local modifications

- Dropped upstream's `name: improve-codebase-architecture` field — the kit's capability loader derives the name from the folder.
- Added kit-required fields: `added_in`, `upstream`, `upstream_version`.

## Cross-skill dependencies

`SKILL.md` references two files in the sibling skill `grill-with-docs` via relative paths:

- `../grill-with-docs/CONTEXT-FORMAT.md`
- `../grill-with-docs/ADR-FORMAT.md`

These resolve correctly in both the kit layout (`capabilities/skills/*/`) and the deployed layout (`.claude/skills/*/` or `.agents/skills/*/`) — both are sibling folders. **If `grill-with-docs` is removed from a preset, those references break**; keep them together.

## Notes

- Model-invocable — `disable-model-invocation` is deliberately NOT set so the model can route here when the user asks about architecture or refactoring.
- `diagnose`'s Phase 6 hands off to this skill — pairs naturally with it.
