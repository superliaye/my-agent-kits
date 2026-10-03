---
name: my-port-code
description: Keep code moves and refactors focused, with disciplined changes to imports, documentation, and comments.
added_in: 0.49.0
---

# my-port-code

- **Scope:** Limit the diff to changes that support the requested move or refactor. Leave unrelated code, cleanup, and refactoring alone.
- **Re-exports:** When moving code, point consumers to the new location. Leave no re-exports at the old location unless the user explicitly requests them; reducing the number of changed files is not a reason to retain them.
- **Documentation:** Keep README and technical docs concise and focused on helping users and agents understand an area as a whole. Code is the source of truth for implementation details. Add detail only when it is essential to that understanding; an observation being useful or interesting does not justify expanding docs that must be kept current.
- **Code comments:** Leave existing comments and JSDoc untouched unless the current change makes them inaccurate or stale.
