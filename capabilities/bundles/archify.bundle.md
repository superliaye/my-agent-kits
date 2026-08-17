---
description: archify — turn a plain-English description of a system or process into a polished, self-contained technical diagram (architecture, workflow, sequence, data-flow, lifecycle) as a single HTML file with a dark/light toggle and up-to-4× PNG/JPEG/WebP/SVG export. Requires Node ≥ 20. No npm install needed for the packaged skill; renderer/validation run on Node at use time.
added_in: 0.46.0
scope: global
installer:
  kind: npx-skills
  package: https://github.com/tt-a1i/archify/tree/cffdd42eed0ebf013aa070378d94facdd3d56b10
  skills:
    - archify
requires:
  - node
  - npx
verify_paths:
  claude:
    - "~/.claude/skills/archify"
  codex:
    - "~/.codex/skills/archify"
license: MIT
---

# archify bundle

Wraps [tt-a1i/archify](https://github.com/tt-a1i/archify) — an agent skill that turns a
plain-English description of a system or process into a polished, self-contained technical
diagram. It generates a typed JSON IR, validates it against a renderer-backed schema, renders
a single dependency-free HTML file, and checks the artifact — then you iterate by chat ("add
Redis", "move auth to the left"). Five modes: architecture, workflow, sequence, data-flow, and
lifecycle.

The kit invokes `npx skills add` with the immutable commit URL above and `--skill archify`
once per selected agent. The upstream CLI is host-aware: passing `--agent claude-code` writes
to `~/.claude/skills/`, while `--agent codex` writes to `~/.codex/skills/`.

`verify_paths` expects the upstream CLI to write the skill under a folder named `archify`. On
the first real host install, check the folder it actually creates under `~/.claude/skills/`
(and `~/.codex/skills/` for Codex) and align `verify_paths` to that name if it differs.

## How updates work

`npx-skills` bundles pin via an immutable GitHub commit URL in `installer.package`. To upgrade archify
across consumer repos:

1. Pick a new commit of [tt-a1i/archify](https://github.com/tt-a1i/archify).
2. Update `installer.package:` above.
3. Bump my-agent-kits version + CHANGELOG.
4. Consumer repos run `agent-kit update <repo>` to pick up the new pin.

See [docs/maintaining-bundles.md](../../docs/maintaining-bundles.md) for the full procedure.

## Runtime requirements

- **Node.js ≥ 20** — used by `npx`, the `skills` CLI, and archify's bundled renderer and
  standalone validators. No `npm install` is required for the packaged skill.

The wizard's pre-flight checks `npx` is on PATH and aborts the bundle install if not.

## Using the output

The generated HTML opens in any modern browser. Controls in the top-right toggle theme
(shortcut `T`) and open Export (shortcut `E`) — copy PNG to clipboard, or download PNG / JPEG /
WebP at up to 4× source resolution, or SVG for lossless vector. Exported SVGs ship both
dark/light variable sets plus `prefers-color-scheme`, so one file follows the reader's system
theme. WebP and clipboard support depend on browser capabilities.
