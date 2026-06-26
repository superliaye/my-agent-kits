---
description: slidev — markdown-driven developer slide decks. Installs the official Slidev AI skills (slide syntax, frontmatter, layouts, code highlighting / magic-move / twoslash, v-click animations, Mermaid, export). Requires Node ≥ 20.12.0. Export to PDF/PNG/PPTX needs project-scoped playwright-chromium (added per deck project, not by this bundle).
added_in: 0.44.0
scope: global
installer:
  kind: npx-skills
  package: slidevjs/slidev
requires:
  - node
  - npx
verify_paths:
  claude: "~/.claude/skills/slidev"
  codex: "~/.agents/skills/slidev"
license: MIT
---

# slidev bundle

Wraps [slidevjs/slidev](https://github.com/slidevjs/slidev) — presentation slides for developers, authored as a single markdown file and rendered to an interactive web deck.

The kit invokes `npx skills add slidevjs/slidev --global --agent <claude-code|codex> --yes` once per selected agent. The upstream CLI is host-aware: passing `--agent claude-code` writes to `~/.claude/skills/`, `--agent codex` to `~/.agents/skills/` — which is Codex's user-skill location (`~/.codex/skills/` holds only config and Codex's bundled `.system` skills, so user skills there would be invisible).

What lands teaches the deck-authoring syntax: slide separators and per-slide frontmatter, layouts, code highlighting with magic-move and twoslash, `v-click` animations, embedded Mermaid diagrams, and the export command. It teaches syntax — it gives no acceptance signal that a deck *renders* legibly. For that, use `/my-slidev`, which drafts the deck and verifies it by exporting each slide to PNG and reading the image back.

`verify_paths` expects the upstream CLI to write the skill under a folder named `slidev`. On the first real host install, check the folder it actually creates under `~/.claude/skills/` (and `~/.agents/skills/` for Codex) and align `verify_paths` to that name if it differs.

## How updates work

`npx-skills` bundles pin via the npm package spec in `installer.package`. To upgrade slidev across consumer repos:

1. Pick a new release of [slidevjs/slidev](https://github.com/slidevjs/slidev). Use a tagged version (e.g. `slidevjs/slidev@52.1.0`) to make the pin reproducible.
2. Update `installer.package:` above.
3. Bump my-agent-kits version + CHANGELOG.
4. Consumer repos run `agent-kit update <repo>` to pick up the new pin.

See [docs/maintaining-bundles.md](../../docs/maintaining-bundles.md) for the full procedure.

## Runtime requirements

- **Node.js ≥ 20.12.0** — Slidev's minimum supported runtime; used by `npx`, the `skills` CLI, and the Slidev dev server / exporter.
- **playwright-chromium — per deck project, not installed by this bundle.** Export to PDF/PNG/PPTX drives a headless Chromium. Slidev does not ship it; add it to each deck project that exports: `npm i -D playwright-chromium`. It is a render-time dependency, not an install-time one — so the bundle does not require it globally.

The wizard's pre-flight checks `npx` is on PATH and aborts the bundle install if not. playwright-chromium absence is not checked at install time — you find out the first time you export.

## Verify your export output

Slidev needs playwright-chromium to export — but a Windows report ([slidevjs/slidev#2091](https://github.com/slidevjs/slidev/issues/2091), against @slidev/cli 51.x) found the opposite: with playwright-chromium installed, the PDF export completed "successfully" yet wrote a ~6 KB all-blank file, and removing playwright-chromium was the reporter's workaround. The issue is closed (suspected an upstream playwright-chromium bug) and may not reproduce on v52, but the export command's exit code never caught it either way. So **after any export, open the output and confirm it actually contains the slides** rather than trusting a zero exit. (This is the PDF-specific gotcha; the PNG read-back loop in `/my-slidev` is what proves a deck renders legibly.)
