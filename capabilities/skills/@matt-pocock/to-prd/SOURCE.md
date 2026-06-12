# Source

Vendored from an upstream repo. To sync with upstream, follow the steps below.

## Upstream

- **Repo**: <https://github.com/mattpocock/skills>
- **Path**: `skills/engineering/to-prd/`
- **Last synced**: 2026-06-12 (vendored at upstream HEAD `694fa30`)
- **Files vendored**:
  - `SKILL.md`

## Re-sync procedure

1. Fetch the upstream files at the path above.
2. Diff against the current vendored copy.
3. Replay any local modifications (see below) on top of the new content.
4. Bump `upstream_version` in `SKILL.md` frontmatter and `Last synced` above.
5. Bump `package.json` version and `added_in` in `SKILL.md` if the content materially changed.

## Local modifications

- Dropped upstream's `name: to-prd` field — the kit's capability loader derives the name from the folder.
- Added kit-required fields: `added_in`, `upstream`, `upstream_version`.
- `disable-model-invocation` deliberately NOT set — this skill is model-invocable.

## External dependencies

- The body references `/setup-matt-pocock-skills` to configure the issue tracker and triage label vocabulary. That setup skill is NOT vendored — it's a Matt-specific setup wizard for his issue-tracker conventions. If a user invokes this skill without it, the model should fall back to asking what issue tracker is in use (GitHub Issues, Linear, etc.) and what triage label to apply.
- Pairs with the vendored `to-issues` skill: `to-prd` writes the PRD; `to-issues` breaks the PRD into vertical-slice tickets.
