---
description: Core repo-agnostic conduct rules — no emojis, evergreen docs, ask before git mutations
applyTo: "**"
added_in: 0.1.0
---

# Core Instructions

## Rules

- Delete commented-out code and personal dev notes
  - Remove: `// TODO: ask John`, `// hack, fix later`, `// I removed this for compatibility`

- Docs describe current state, not history. Rewrite, don't append.
  - Remove: "Last Updated: Jan 2025", "moved from old-file.md", "Update: we now also support..."

- Git mutations (add/commit/push) need confirmation. Read-only (status/diff/log) are safe.
  - Ask before: `git commit -m "..."` -> Do without asking: `git diff`

- No emojis. No excessive praise. Direct and objective.
  - Avoid: "Great question!" -> Prefer: "Here's how to fix it."

## Suggesting New Rules

If you notice patterns worth adding: mention it. High bar: must prevent recurring mistakes, not be obvious, apply broadly.
