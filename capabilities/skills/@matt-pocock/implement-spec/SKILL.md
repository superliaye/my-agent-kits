---
name: implement-spec
description: "Implement the result of /to-spec and its tickets in code."
disable-model-invocation: true
added_in: 0.53.0
upstream: https://github.com/mattpocock/skills
upstream_version: "2026-10-19 (5beb35b)"
---

You have been provided a spec. This spec should have tickets associated with it, describing how to implement the spec.

Discover the issue tracker before reading the tickets: read `docs/agents/issue-tracker.md` and
nearby agent/contributor docs when present, inspect the spec's linked issues, and use git remotes
as supporting evidence. If the tracker or how it closes work remains ambiguous, ask the user
directly.

The goal is the entire spec implemented on a single **integration branch**, with every ticket resolved the way the issue tracker closes work.

The tickets are not a list of steps. They are a **task graph** with blocking relationships between them. This means there is always a **frontier** of tickets which are ready to be grabbed.

Communication to and from subagents should be sparse. Communicate primarily through **context pointers**: to the spec, tickets, research notes, and previous commits. Don't duplicate information already available via pointers.

**Implementer subagents** should be run in the background where possible for maximum concurrency.

## Steps

1. Read the spec and tickets to understand the task graph.

2. (optional) Use an **exploration subagent** to conduct any exploration required by the tickets - relevant codebase files or external documentation. Ensure the exploration subagent can save files - it should save its markdown notes in a unique per-run directory created with the operating system's temporary-directory facility, and you pass that absolute path to all future subagents. This lets **implementer subagents** focus on implementation rather than exploration.

3. Before any Git or tracker mutation, show the user the run plan: the integration branch, one worktree and branch per ticket, the merges, and any push, draft PR, or ticket closure. Get their explicit authorization for that plan. Without it, stop here and report the task graph and any notes path. Then create the integration branch. If the issue tracker closes work through PRs, or the user asks for one, open a draft PR after the first merge in step 5 (a branch with no commits ahead of main can't open one), marked as closing the spec and tickets.

4. Use **implementer subagents** to implement each ticket, each in its own worktree on its own branch. Each implementer subagent:
   - confirms its worktree is based on the integration branch before starting, and resets onto it if not;
   - calls the Skill tool with `tdd` to build the ticket;
   - merges the integration branch tip into its own branch before reporting done

5. Once an **implementer subagent** completes, merge its work to the integration branch with a **merger subagent**.

6. If this changes the **frontier** of available tickets, kick off more **implementer subagents** to work on the new tickets. This allows for maximum concurrency.

7. Once all tickets are complete, call the Skill tool with `code-review` on the integration branch. Fix all issues raised by the code review in a single **implementer subagent**.

8. If a draft PR exists, mark it ready for review. Otherwise, resolve each ticket the way the issue tracker closes work, and report the integration branch.

9. Clean up all **implementer subagent** worktrees.
