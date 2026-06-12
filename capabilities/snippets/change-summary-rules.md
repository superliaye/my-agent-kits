## Audience

Write for human code reviewers. They can read the diff, so do not repeat details that are obvious from the code.

## Structure

1. **Outcome**: A concise sentence or short paragraph describing the result of the change: the problem solved, behavior improved, architectural goal achieved, or metric intended to move. Only state the practical impact when it exists. Do not manufacture business impact for routine engineering changes.

2. **Context and approach**: Include the details a reviewer needs to form a useful mental model before reading the diff.

   For issue fixes, cover the relevant parts of:
   - Problem: What symptom does the user see, or what incorrect behavior does the system exhibit?
   - Root cause: Under what conditions does it happen, and why?
   - Fix: What approach does this change take?

   For non-fix changes, summarize:
   - Why: Why is the change needed?
   - Approach: What high-level strategy does the change use?

   Reference specific implementation details only when they add context that a reviewer cannot efficiently infer from the diff.

3. **Appendix**: Add a collapsed <details> appendix only when it provides useful deeper context for reviewers, future agents, or code archaeology.

   Possible contents include behavior matrices, edge cases, validation results, migration notes, or a file-level map for unusually broad changes.

## Style

- Be direct and brief. Assume the reader is an experienced engineer.
- Prefer a useful executive summary over a chronological account of the work.
- Do not pad the summary with filler, caveats, or generic statements.
- Do not enumerate every file changed, function modified, or line edited.
- Do not claim impact, root causes, or validation results that are not supported by the local changes or available context.

## Format
Unless explicitly instructed otherwise, wrap the entire output in a fenced code block so the user can copy the raw Markdown without the chat interface rendering it.