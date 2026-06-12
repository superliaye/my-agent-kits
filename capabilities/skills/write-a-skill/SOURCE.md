# Source

Vendored from an upstream repo. To sync with upstream, follow the steps below.

## Upstream

- **Repo**: <https://github.com/mattpocock/skills>
- **Path**: `skills/productivity/write-a-skill/`
- **Last synced**: 2026-05-22 (vendored at `upstream_version: 1.1.0`, upstream HEAD `b8be62f`)
- **Files vendored**:
  - `SKILL.md`

## Re-sync procedure

1. Fetch the upstream files at the path above.
2. Diff against the current vendored copy.
3. Replay any local modifications (see below) on top of the new content.
4. Bump `upstream_version` in `SKILL.md` frontmatter and `Last synced` above.
5. Bump `package.json` version and `added_in` in `SKILL.md` if the content materially changed.

## Local modifications

- Dropped upstream's `name: write-a-skill` field — the kit's capability loader derives the name from the folder.
- Added kit-required fields: `added_in`, `upstream`, `upstream_version`.
- `disable-model-invocation` deliberately NOT set — this skill is model-invocable.

## Notes

- The "SKILL.md Template" snippet inside the body shows an upstream-style frontmatter block (with `name:`, without `added_in`/`upstream`/`upstream_version`). That's a template the model is supposed to *write out for the user*, not the schema this kit uses for vendored skills. If you author a skill specifically for this kit, follow the conventions in the surrounding [capabilities/skills/](../) folders — see `improve-codebase-architecture/SOURCE.md` for the canonical vendor pattern, or any of the `my-*` skills for an in-house pattern.
