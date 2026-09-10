## Phase 3 — Draft `plan.md` + `acceptance.md` (loop-build's exact format)

From the resolved grill, write the two artifacts `/loop-build` consumes — in **loop-build's
exact format**, so the build step reads them with no reshaping.

**`plan.md`** — use the binding intent / non-binding implementation hypotheses structure above and
ground it in the research brief's `file:line` map. When a hypothesis proposes a new marker, schema
value, gate, or status, name the existing contract it must satisfy and confirm at `file:line` that
the contract can produce it.

**`acceptance.md`** — apply the sparse release contract above. State delivered outcomes, not plan
steps or internal metrics. Include both block headers even when one is empty and mark the empty block
explicitly. Verification stays contract-driven. A file change alone does not justify a test or
affected-suite criterion.

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
