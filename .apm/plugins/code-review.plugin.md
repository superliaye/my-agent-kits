---
description: Pre-landing code-review orchestrator from Anthropic. Fans out parallel Haiku/Sonnet/Opus workers (PR triage, CLAUDE.md compliance, bug scan, security, validation). Used by `feature-loop`'s Phase 4 when installed; the orchestrator's inline review pattern is the fallback.
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

Used by [`feature-loop`](../skills/feature-loop/SKILL.md) Phase 4. If absent, the orchestrator falls back to spawning 3 review workers (A bug, B security/logic, C compliance) directly from the main agent — same pattern, simpler scope.

License: Apache-2.0 (per claude-plugins-official marketplace). Source: <https://github.com/anthropics/claude-plugins-official>.
