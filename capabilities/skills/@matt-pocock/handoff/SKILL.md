---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up.
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
added_in: 0.12.0
upstream: https://github.com/mattpocock/skills
upstream_version: "2026-08-24 (6654f6b)"
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Create a unique per-run directory using the temporary-directory facility of the user's OS, save the document as `handoff.md` inside it, and print the exact absolute path. Do not write it to the current workspace.

Include a "suggested skills" section in the document, naming which skills the next agent should call the Skill tool for.

Do not duplicate content already captured in other artifacts (specs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information, such as API keys, passwords, or personally identifiable information.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.
