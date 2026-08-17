# Source

Vendored from an upstream repo. To sync with upstream, follow the steps below.

## Upstream

- **Repo**: <https://github.com/mattpocock/skills>
- **Path**: `skills/engineering/to-tickets/`
- **Last synced**: 2026-08-17 (vendored at upstream HEAD `068b6e0c62393147daf03530149cdce209c93da8`; local invocable name remains `to-issues`)
- **Files vendored**:
  - `SKILL.md`

## Re-sync procedure

1. Fetch the upstream files at the path above.
2. Diff against the current vendored copy.
3. Replay any local modifications (see below) on top of the new content.
4. Bump `upstream_version` in `SKILL.md` frontmatter and `Last synced` above.
5. Bump `package.json` version and `added_in` in `SKILL.md` if the content materially changed.

## Local modifications

- Dropped upstream's `name: to-tickets` field — the kit retains the stable `to-issues` folder/invocable name.
- Added kit-required fields: `added_in`, `upstream`, `upstream_version`.
- `disable-model-invocation` deliberately NOT set — this skill is model-invocable.

## External dependencies

- The body references `/setup-matt-pocock-skills` for issue-tracker + triage-label setup. That setup skill is NOT vendored. If invoked without it, the model should ask the user which issue tracker (GitHub Issues, Linear, etc.) and what triage label to apply.
- Pairs with the vendored `to-prd` skill: `to-prd` writes a PRD; `to-issues` breaks it into vertical-slice tickets.
- The body references a `prototype` snippet exception — the vendored `prototype` skill provides that complementary throwaway-code workflow.
