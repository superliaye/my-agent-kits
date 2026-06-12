# Source

Vendored from an upstream repo. To sync with upstream, follow the steps below.

## Upstream

- **Repo**: <https://github.com/mattpocock/skills>
- **Path**: `skills/productivity/handoff/`
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

- Dropped upstream's `name: handoff` field — the kit's capability loader derives the name from the folder.
- Added kit-required fields: `added_in`, `upstream`, `upstream_version`.
- Preserved upstream's `argument-hint` field — Claude Code surfaces this as a hint when the user invokes the skill with `/handoff <args>`.
- `disable-model-invocation` deliberately NOT set — this skill is model-invocable.
