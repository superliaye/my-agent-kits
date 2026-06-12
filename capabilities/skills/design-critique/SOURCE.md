# Source

Vendored from an upstream repo. To sync with upstream, follow the steps below.

## Upstream

- **Repo**: <https://github.com/anthropics/knowledge-work-plugins>
- **Path**: `design/skills/design-critique/SKILL.md`
- **Last synced**: 2026-05-17 (vendored at `upstream_version: a0fda66` — commit `a0fda662dd52f2704c43a57ea38ff7de647b013f`, authored 2026-05-13)
- **License**: Apache-2.0
- **Files vendored**:
  - `SKILL.md`

## Re-sync procedure

1. Fetch the upstream file at the path above.
2. Diff against the current vendored copy.
3. Replay any local modifications (see below) on top of the new content.
4. Bump `upstream_version` in `SKILL.md` frontmatter and `Last synced` above to the new short SHA + ISO date.
5. Bump `package.json` version and `added_in` in `SKILL.md` if the content materially changed.

## Local modifications

- Dropped upstream's `name: design-critique` field — the kit's capability loader derives the name from the folder.
- Added kit-required fields: `added_in`, `upstream`, `upstream_version`, `license`.
- Removed the upstream link to `CONNECTORS.md` (the surrounding plugin scaffold isn't part of this skill).
- Removed the **"If Connectors Available"** section — the `~~design tool` / `~~user feedback` connectors are upstream-internal placeholders not relevant to the kit deployment.
- Stripped emoji indicators (🔴🟡🟢) from the severity column per the kit's no-emoji convention; replaced with plain text labels (Critical / Moderate / Minor).

## Notes

- Model-invocable — `disable-model-invocation` is deliberately NOT set so `feature-loop`'s Phase 5b can route here.
- Tied into `feature-loop`'s Phase 5b — consumes the screenshots produced by `web-visual-loop` or `electron-visual-loop` and produces a structured critique against the design brief from Phase 2.
