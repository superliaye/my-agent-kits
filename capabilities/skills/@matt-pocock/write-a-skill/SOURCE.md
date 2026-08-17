# Source

Vendored from an upstream repo. To sync with upstream, follow the steps below.

## Upstream

- **Repo**: <https://github.com/mattpocock/skills>
- **Path**: `skills/productivity/writing-for-agents/`
- **Last synced**: 2026-08-17 (reviewed at upstream HEAD `068b6e0c62393147daf03530149cdce209c93da8`; local invocable name and skill-authoring job remain stable)
- **Files vendored**:
  - `SKILL.md`

## Re-sync procedure

1. Fetch the upstream files at the path above.
2. Diff against the current vendored copy.
3. Replay any local modifications (see below) on top of the new content.
4. Bump `upstream_version` in `SKILL.md` frontmatter and `Last synced` above.
5. Bump `package.json` version and `added_in` in `SKILL.md` if the content materially changed.

## Local modifications

- Dropped upstream's `name: writing-for-agents` field — the kit retains the stable `write-a-skill` folder/invocable name and focused job.
- Added kit-required fields: `added_in`, `upstream`, `upstream_version`.
- `disable-model-invocation` deliberately NOT set — this skill is model-invocable.
- Retained the focused skill-authoring workflow because upstream broadened the successor into a reference for every agent-consumed document.

## Notes

- The "SKILL.md Template" snippet inside the body shows an upstream-style frontmatter block (with `name:`, without `added_in`/`upstream`/`upstream_version`). That's a template the model is supposed to *write out for the user*, not the schema this kit uses for vendored skills. If you author a skill specifically for this kit, follow the conventions in the surrounding [capabilities/skills/](../) folders — see `improve-codebase-architecture/SOURCE.md` for the canonical vendor pattern, or any of the `my-*` skills for an in-house pattern.
