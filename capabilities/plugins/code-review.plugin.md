---
description: Pre-landing code-review orchestrator from Anthropic. Fans out parallel Haiku/Sonnet/Opus workers (PR triage, CLAUDE.md compliance, bug scan, security, validation).
applyTo: "**"
added_in: 0.10.2
marketplace_source: anthropics/claude-plugins-official
marketplace_name: claude-plugins-official
plugin_name: code-review
---

# Code Review (Anthropic)

Anthropic-published plugin. Provides the `/code-review` slash command that runs an autonomous, multi-worker review pipeline on a pull request:

1. Haiku triage (skip drafts, closed PRs, already-reviewed)
2. Haiku CLAUDE.md path enumeration
3. Sonnet PR summary
4. Four parallel reviewers (CLAUDE.md compliance × 2, bug scan opus × 2)
5. Validator pass to drop false positives
6. Optional inline PR comments via `--comment`

License: Apache-2.0 (per claude-plugins-official marketplace). Source: <https://github.com/anthropics/claude-plugins-official>.
