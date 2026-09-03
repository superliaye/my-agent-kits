---
name: research
description: Investigate a question against high-trust primary sources and capture the findings as a Markdown file in the repo. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
added_in: 0.47.0
upstream: https://github.com/mattpocock/skills
upstream_version: "2026-08-24 (6654f6b)"
---

Spin up a **background agent** to do the research, so you keep working while it reads.

Its job:

1. Investigate the question against **primary sources** (official docs, source code, specs, first-party APIs), not a secondary write-up of them. Follow every claim back to the source that owns it.
2. Write the findings to a single Markdown file, citing each claim's source.
3. Honor an explicit output path supplied by the caller. Otherwise find the repo's existing
   research-note convention; if none exists, use `.scratch/research/<run-key>/research.md`.
   Mint a unique `<run-key>` from the topic and disambiguate it if the directory exists, so
   concurrent runs cannot collide. Pass that explicit path to the subagent and, when it
   returns, print the exact absolute path.
