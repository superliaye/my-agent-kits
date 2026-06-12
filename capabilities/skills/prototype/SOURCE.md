# Source

Vendored from an upstream repo. To sync with upstream, follow the steps below.

## Upstream

- **Repo**: <https://github.com/mattpocock/skills>
- **Path**: `skills/engineering/prototype/`
- **Last synced**: 2026-05-22 (vendored at `upstream_version: 1.1.0`, upstream HEAD `b8be62f`)
- **Files vendored**:
  - `SKILL.md`
  - `LOGIC.md`
  - `UI.md`

## Re-sync procedure

1. Fetch the upstream files at the path above.
2. Diff against the current vendored copy.
3. Replay any local modifications (see below) on top of the new content.
4. Bump `upstream_version` in `SKILL.md` frontmatter and `Last synced` above.
5. Bump `package.json` version and `added_in` in `SKILL.md` if the content materially changed.

## Local modifications

- Dropped upstream's `name: prototype` field — the kit's capability loader derives the name from the folder.
- Added kit-required fields: `added_in`, `upstream`, `upstream_version`.
- `disable-model-invocation` deliberately NOT set — this skill is model-invocable.

## Notes

- The body's two-branch routing (LOGIC for state/data questions, UI for visual-design questions) makes this complementary to the `feature-loop` preset's visual-loop skills: prototype answers "what's the shape?" before feature-loop builds the production version.
- Pairs with vendored `to-prd` / `to-issues`: prototype outputs may produce small decision-encoding snippets that get inlined verbatim into a PRD or issue body (both upstream templates carry an explicit exception for this case).
