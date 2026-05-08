# my-agent-kits

Status: **design phase — no implementation yet**.

Private mono-repo for personal + Microsoft-internal AI agent artifacts (instructions, prompts, skills, MCP configs) plus an interactive wizard (`agent-kit init`) that deploys them to Claude Code, GitHub Copilot, Codex CLI, and Cursor on a per-repo or global basis via APM.

## Where to start

- **[Design spec](docs/superpowers/specs/2026-05-08-agent-kit-installer-design.md)** — the full plan (problem, decisions, repo layout, wizard flow, test matrix, migration path).

The spec is the single source of truth until implementation begins. Implementation plan to be drafted next via the `superpowers:writing-plans` skill.

## Related repos

- `superliaye/dotfiles` — shell aliases, install scripts (kept; out of scope for this tool).
- `superliaye/personal-agent-kit` — APM package; will be folded into this repo and archived once `my-agent-kits` is operational.
