---
description: gstack — 30+ slash commands (planning, design, review, QA, ship, security, browser automation). Installs to ~/.claude/skills/gstack/ with /gstack-* prefix. Runtime deps (Bun, Playwright Chromium) are auto-installed by the wizard.
added_in: 0.7.0
source: https://github.com/garrytan/gstack.git
pinned_commit: dc6252d1df7f1f650ea6e9b2bba7d08fab5de902
scope: global
installer:
  command: ./setup
  flags: ["--prefix", "--no-team", "--quiet"]
  host_flag_map:
    claude: ["--host", "claude"]
    codex: ["--host", "codex"]
requires:
  - bun
  - git
verify_paths:
  claude: "~/.claude/skills/gstack"
  codex: "~/.codex/skills/gstack"
license: MIT
---

# gstack bundle

Wraps [garrytan/gstack](https://github.com/garrytan/gstack) — a toolkit of 30+ Claude Code skills modeled as a virtual engineering team (CEO, designer, engineer, QA, security officer).

What lands in `~/.claude/skills/gstack/` (per-agent, depending on selection):

- **Planning**: `/gstack-office-hours`, `/gstack-autoplan`, `/gstack-plan-{ceo,eng,design,devex}-review`, `/gstack-design-consultation`
- **Build**: `/gstack-design-shotgun`, `/gstack-design-html`
- **Review/QA**: `/gstack-review`, `/gstack-qa`, `/gstack-qa-only`, `/gstack-investigate`, `/gstack-benchmark`, `/gstack-canary`, `/gstack-devex-review`
- **Ship**: `/gstack-ship`, `/gstack-land-and-deploy`, `/gstack-document-release`
- **Security/safety**: `/gstack-cso`, `/gstack-careful`, `/gstack-guard`, `/gstack-freeze`, `/gstack-unfreeze`
- **Browser**: `/gstack-browse`, `/gstack-open-gstack-browser`, `/gstack-connect-chrome`, `/gstack-setup-browser-cookies`, `/gstack-pair-agent`
- **Knowledge**: `/gstack-retro`, `/gstack-learn`, `/gstack-setup-gbrain`, `/gstack-sync-gbrain`
- **Misc**: `/gstack-codex`, `/gstack-setup-deploy`, `/gstack-gstack-upgrade`

## Windows caveat

gstack's setup script registers commands via `ln -snf` (POSIX symlinks). On Windows that requires either **Developer Mode enabled** (Settings → Privacy & Security → For developers) or running the wizard from an **elevated shell**. Without either, the installer exits with status 0 but no `~/.claude/skills/gstack/` link is created — and the kit's post-install verify will flag it MISSING. If you hit this:

1. Enable Developer Mode (no reboot needed).
2. Re-run `agent-kit update <repo>` (or re-init the bundle) — gstack's setup is idempotent.

## How updates work

The pinned commit in this file's frontmatter determines which gstack revision the wizard installs. To upgrade gstack across all consumer repos:

1. Pick a new gstack commit.
2. Update `pinned_commit:` above.
3. Bump my-agent-kits version + CHANGELOG.
4. Consumer repos run `agent-kit update <repo>` to pick up the new pin.

See [docs/maintaining-bundles.md](../../docs/maintaining-bundles.md) for the full procedure.
