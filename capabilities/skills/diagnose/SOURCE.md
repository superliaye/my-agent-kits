# Source

Vendored from an upstream repo. To sync with upstream, follow the steps below.

## Upstream

- **Repo**: <https://github.com/mattpocock/skills>
- **Path**: `skills/engineering/diagnose/`
- **Last synced**: 2026-05-22 (vendored at `upstream_version: 1.1.0`, upstream HEAD `b8be62f`)
- **Files vendored**:
  - `SKILL.md`
  - `scripts/hitl-loop.template.sh`

## Re-sync procedure

1. Fetch the upstream files at the path above.
2. Diff against the current vendored copy.
3. Replay any local modifications (see below) on top of the new content.
4. Bump `upstream_version` in `SKILL.md` frontmatter and `Last synced` above.
5. Bump `package.json` version and `added_in` in `SKILL.md` if the content materially changed.

## Local modifications

- Dropped upstream's `name: diagnose` field — the kit's capability loader derives the name from the folder.
- Added kit-required fields: `added_in`, `upstream`, `upstream_version`.

## Notes

- The body's Phase 6 hands off to the `/improve-codebase-architecture` skill — also vendored at `capabilities/skills/improve-codebase-architecture/` from the same upstream.
- Model-invocable — `disable-model-invocation` is deliberately NOT set so the model can route into this skill when the user reports a bug or perf regression.
