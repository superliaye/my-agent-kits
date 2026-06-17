## Phase 3 — Draft `plan.md` + `acceptance.md` (loop-build's exact format)

From the resolved grill, write the two artifacts `/loop-build` consumes — in **loop-build's
exact format**, so the build step reads them with no reshaping.

**`plan.md`** — the change to make, with **per-item intent**: each item states *what* to
build and *why*, in build order, grounded in the research brief's `file:line` map. Not a
narrative — a buildable list.

**`acceptance.md`** — observable criteria in loop-build's **two blocks**:

```markdown
## Non-visual acceptance     (present whenever behaviour changes)
- [ ] <observable behavioural outcome> — verify: <cmd / test / assertion>

## Visual acceptance          (REQUIRED when the change involves visuals)
- [ ] <observable UI outcome> — env: web|electron|desktop — at: <route/state>
```

- A style-only change carries visual criteria and few non-visual ones; a pure-logic
  change is the reverse. Include **both** block headers even when one is empty, and say so
  explicitly (e.g. "Visual acceptance: (none — no UI)") — never drop a block silently.
- Each criterion must be **observable and verifiable**: a non-visual one names the
  command / test / assertion that proves it; a visual one names the env and the
  route/state to look at.

### Where the artifacts go

Write both to a **fresh per-run folder**: `~/.loop-plan/<repo-key>/<run-key>/` — a
host-neutral home-dir path, so nothing dirties git. `<repo-key>` identifies the repo (its
folder name / remote); `<run-key>` **isolates this run** — mint a short slug from the topic
(e.g. `audit-log-settings`) and, if that folder already exists, add a disambiguating suffix,
so you never overwrite a prior or concurrent run. The path is **overridable** — if the user
names an output location, honour it.

Assume **concurrent runs and leftover artifacts** in the same repo; the per-run key is what
keeps them apart. The exact `plan.md` + `acceptance.md` paths you write are the hand-off —
the user and, later, `/loop-build` target *this* run's plan by that explicit path, never a
guessed default.
