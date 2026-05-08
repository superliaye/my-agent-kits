---
description: Review staged changes for code quality and obvious bugs
applyTo: "**"
added_in: 0.1.0
---

# Code review

When the user asks for a code review, follow this checklist:

1. Run `git diff --staged` to see exactly what's about to be committed.
2. Identify the smallest unit of change that has a clear purpose. Comment on each unit independently.
3. For each change, check:
   - Naming: does the new identifier read clearly outside this commit's context?
   - Side effects: any unintentional file/network/state change?
   - Error paths: what happens on failure, and is the failure surfaced?
   - Tests: is the change tested, and does the test fail without the change?
4. If the diff has unrelated changes, suggest splitting into separate commits.
5. End with a single sentence: ship / fix-first / discuss.
