# Source

Vendored from an upstream repo. To sync with upstream, follow the steps below.

## Upstream

- **Repo**: <https://github.com/mattpocock/skills>
- **Path**: `skills/engineering/zoom-out/`
- **Last synced**: 2026-08-17 (reviewed at upstream HEAD `068b6e0c62393147daf03530149cdce209c93da8`; upstream removed this capability in commit `e112a6b`)
- **Files vendored**:
  - `SKILL.md`

## Re-sync procedure

1. Fetch the upstream files at the path above.
2. Diff against the current vendored copy.
3. Replay any local modifications (see below) on top of the new content.
4. Bump `upstream_version` in `SKILL.md` frontmatter and `Last synced` above.
5. Bump `package.json` version and `added_in` in `SKILL.md` if the content materially changed.

## Local modifications

- Dropped upstream's `name: zoom-out` field — the kit's capability loader derives the name from the folder.
- Added kit-required fields: `added_in`, `upstream`, `upstream_version`.
- Preserved upstream's `disable-model-invocation: true` — this is a slash-command-only skill (the model shouldn't auto-route into it; the user invokes it explicitly when they want to step up an abstraction layer).
- Retained the last shipped body to preserve the stable `/zoom-out` capability; there is no newer upstream body to sync.
