# Source

Clean-room skill — not vendored from an upstream. Written as the web-stack counterpart to [electron-visual-loop](../electron-visual-loop/SKILL.md), using the same transport (`agent-browser` CDP) so installing both skills only requires one runtime dependency.

## Why not vendor `webapp-testing`?

[anthropics/skills/webapp-testing](https://github.com/anthropics/skills/blob/main/skills/webapp-testing/SKILL.md) is the official Anthropic-published web testing skill (Apache-2.0) and was the obvious vendor candidate. Decision against:

- `webapp-testing` uses **Python + Playwright** as its transport. `electron-visual-loop` already uses `agent-browser` (Node CLI, CDP-based). Vendoring `webapp-testing` would mean the kit's Phase 5 has two incompatible transports for web vs Electron — adding a Python runtime requirement on top of the existing Node one.
- The CDP feedback loop pattern is **public and well-documented** (juri.dev article, fcakyon's electron skill). Writing this skill as a clean-room CDP equivalent keeps the kit consistent on `agent-browser`.

`webapp-testing` remains a fine choice for users who already have Python + Playwright and want richer testing primitives. For autonomous visual verification inside the `feature-loop` orchestrator, `web-visual-loop` is the simpler match.

## Runtime dependency

- `agent-browser` CLI (Node) — `npm i -g agent-browser` or `npx agent-browser`.
- A Chromium-based browser on PATH.

Both shared with `electron-visual-loop`. The kit declares no Python requirement.

## Notes

- Model-invocable — `disable-model-invocation` is deliberately NOT set, so the orchestrator and other skills can route here when the user iterates on a web UI.
- Tied into `feature-loop`'s Phase 5a (visual verification for web stacks) — see [feature-loop SKILL.md](../feature-loop/SKILL.md) Dependency map.
