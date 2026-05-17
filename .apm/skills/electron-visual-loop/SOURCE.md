# Source

Vendored from an upstream repo. To sync with upstream, follow the steps below.

## Upstream

- **Repo**: <https://github.com/fcakyon/claude-codex-settings>
- **Path**: `plugins/agent-browser/skills/electron/SKILL.md`
- **Last synced**: 2026-05-17 (vendored at `upstream_version: 9ad3323` — commit `9ad3323e3f7eadb239368c0b8956452451418d92`, authored 2026-05-09)
- **Files vendored**:
  - `SKILL.md`

## Re-sync procedure

1. Fetch the upstream file at the path above.
2. Diff against the current vendored copy.
3. Replay any local modifications (see below) on top of the new content.
4. Bump `upstream_version` in `SKILL.md` frontmatter and `Last synced` above to the new short SHA + ISO date.
5. Bump `package.json` version and `added_in` in `SKILL.md` if the content materially changed.

## Local modifications

- Dropped upstream's `name: electron` field — the kit's primitive loader derives the name from the folder (`electron-visual-loop`).
- Renamed the slug from upstream's `electron` to `electron-visual-loop` to capture the primary use case (in-development renderer feedback loop, not just third-party desktop automation).
- Added kit-required fields: `added_in`, `upstream`, `upstream_version`.
- Extended `description` to mention the in-development "visual feedback loop" use case so the model routes here when working on a Vite/Electron renderer, not only when controlling third-party Electron apps.
- Added a new section **"In-development Electron apps (electron-vite, etc.)"** documenting the `--remote-debugging-port=9333` pattern from juri.dev — bakes the flag into `package.json` dev script so CDP is always available during development.
- Added Windows-friendly note in the troubleshooting section (`netstat -ano | findstr :9222` alongside `lsof`).
- Added a **"Runtime requirement"** section noting `agent-browser` must be on PATH (or invoked via `npx agent-browser`). The kit does not auto-install it.

## Notes

- Model-invocable — `disable-model-invocation` is deliberately NOT set so the model can route here when the user works with an Electron app or asks for a visual feedback loop.
- **Opt-in only** — not wired into any preset. Install per-repo with `agent-kit init … --primitives '+electron-visual-loop'`, or add to a preset's `primitives.skills` list locally if you maintain a stack-specific preset.
- Runtime dependency: [`agent-browser`](https://agent-browser.dev/) CLI (Vercel). Install via `npm i -g agent-browser` or invoke via `npx agent-browser <cmd>`. The `allowed-tools` frontmatter whitelists both forms.
- Related upstream context: ["A Visual Feedback Loop for Electron Apps with Claude Code" (juri.dev, Mar 2026)](https://juri.dev/articles/visual-feedback-loop-electron-apps-claude-code/).
