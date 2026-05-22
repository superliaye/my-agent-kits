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

## Research current-state claims

Don't answer "how are people doing X these days" / "what's the recommended Y" / "is Z still maintained" from training. Tool ecosystems move; training data is stale.

- Trigger: current community practice, recent versions, library status, "what's recommended now", "have people moved past..."
- Action: WebSearch + WebFetch official docs + recent (≤12mo) sources, or spawn a research agent. Label what came from where ("docs say X" vs "community thread reports Y"). Cite URLs.
- Skip: stable knowledge — language semantics, algorithms, OS internals, math.

If asked a current-state question and you answered from training, say so up front. Don't hide it.

## Suggesting New Rules

If you notice patterns worth adding: mention it. High bar: must prevent recurring mistakes, not be obvious, apply broadly.

# TypeScript Rules

- Alert on `any` usage. If no straightforward fix, ask user.

- Forbidden: `as any`, `as unknown as` - must fix, no exceptions.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
