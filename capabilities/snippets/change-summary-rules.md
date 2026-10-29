## Audience

Write for human reviewers who will read the code anyway. The summary carries what the code cannot: why the change exists, what a user or caller now sees differently, and decisions the code does not record. Write at outcome level and leave mechanism (how the code does it, its internal states, its edge cases) to the diff.

The user's request sets the sections. When it names what to cover, write only those sections; otherwise use the structure below. Keep each prose section to one to three sentences unless the user asks for more.

## Structure

1. **Outcome**: A concise sentence or short paragraph describing the result of the change: the problem solved, behavior improved, architectural goal achieved, or metric intended to move. Only state the practical impact when it exists. Do not manufacture business impact for routine engineering changes.

2. **Context and approach**: Include the details a reviewer needs to form a useful mental model before reading the diff.

   For issue fixes, cover the relevant parts of:
   - Problem: What symptom does the user see, or what incorrect behavior does the system exhibit?
   - Root cause: Why does it happen?
   - Fix: What approach does this change take?

   For non-fix changes, summarize:
   - Why: Why is the change needed?
   - Approach: What high-level strategy does the change use?

3. **Before and after**: When the change alters behavior that a person can observe, show it as a before/after pair.

   - Prefer screenshots when the change is visible in a UI. Capture them with `web-visual-loop`, `electron-visual-loop`, or `desktop-app-loop`, whichever matches how the app ships. If the before state is gone, describe it in one line; do not check out other revisions to recreate it.
   - Otherwise show execution evidence: the command output, error, or test that failed before and passes after. Outline a test as short pseudocode, not its full source.
   - Skip this section when the change has no observable behavior, such as a refactor, docs, or build plumbing.

   Save screenshots in a per-run directory under the OS temporary directory, never in the repository. When the PR tool uploads images (for example `gh pr create --attach <path>` or `gh pr edit --attach <path>`), reference each one in the body as `![Before: <what it shows>](<path>)` with the same path you attach. Otherwise list the absolute paths after the summary so the user can attach them.

4. **Appendix**: Add a collapsed <details> appendix only when it provides useful deeper context for reviewers, future agents, or code archaeology.

   Possible contents include behavior matrices, edge cases, validation results, migration notes, or a file-level map for unusually broad changes.

   Omit routine success reports such as passing test counts or green CI. Include validation when it establishes a specific claim or exposes a meaningful gap.

## Style

- Assume the reader is an experienced engineer.
- Prefer a useful executive summary over a chronological account of the work.
- Do not pad the summary with filler, caveats, or generic statements.
- Do not enumerate every file changed, function modified, or line edited.
- Do not claim impact, root causes, or validation results that are not supported by the local changes or available context.

## Format
Unless explicitly instructed otherwise, wrap the entire output in a fenced code block so the user can copy the raw Markdown without the chat interface rendering it.
