---
description: Create a detailed git commit with comprehensive summary
allowed-tools: Bash(git:*)
disable-model-invocation: true
added_in: 0.3.0
---

Create a git commit following best practices:

1. Run git status and git diff to see changes
2. Analyze all changes (not just latest)
3. Create a commit message with:
   - Clear summary line
   - Detailed breakdown of changes
   - Why the changes were made
   - Build/test status if applicable

Always end with:
```
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

Do NOT push unless explicitly requested.
