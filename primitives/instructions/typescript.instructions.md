---
description: TypeScript conduct — no `any`, no `as any`, no `as unknown as`
applyTo: "**/*.{ts,tsx}"
added_in: 0.1.0
---

# TypeScript Rules

- Alert on `any` usage. If no straightforward fix, ask user.

- Forbidden: `as any`, `as unknown as` - must fix, no exceptions.
