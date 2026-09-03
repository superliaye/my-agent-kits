---
name: loop-review-committee
description: Reviews a committed or worktree change through the applicable subset of five separate lenses — architecture, documented rules, correctness, spec conformance, and Fowler smells. Pins one immutable review payload, reports every run/skip decision, runs selected reviewers in capacity-aware parallel batches, and keeps their findings grouped by lens. Use for a multi-perspective code review, committee review, or non-interactive review from /loop-build.
added_in: 0.31.0
---

# /loop-review-committee

Review one pinned change set. You are the `loop-review-committee` executor: capture the evidence,
decide which of the five independent lenses apply, spawn only those reviewers, and present their
axes separately. The executor is the root resident when invoked directly and the build agent when
invoked inside `/loop-build`.

The invocation accepts:

- **BASE** — a commit, branch, or tag used to resolve the merge-base.
- **TARGET** — `committed` or `worktree`.
- **SPEC SOURCES** — optional originating issue/spec paths or exact contents.

Resolve omitted inputs without prompting:

- With neither input, use `BASE=HEAD`, `TARGET=worktree` when tracked or non-ignored untracked
  changes exist; otherwise use the remote default branch (falling back to `main`) and
  `TARGET=committed`.
- With only TARGET, use `BASE=HEAD` for `worktree`; for `committed`, use the remote default branch
  (falling back to `main`).
- With only BASE, use `TARGET=worktree` when tracked or non-ignored untracked changes exist and
  `TARGET=committed` otherwise.

Record the resolved values; never leave the target mode implicit.

<!-- include: source-tree-fingerprint -->

<!-- include: review-payload-contract -->

## 1. Capture one immutable review payload

Pin `BASE_OID` with `git rev-parse --verify <BASE>^{commit}` and `HEAD_OID` with
`git rev-parse --verify HEAD`, then resolve `REVIEW_BASE` with
`git merge-base <BASE_OID> <HEAD_OID>`. Use only these object ids in later capture commands; fail on
a bad ref or empty selected change set. For `TARGET=committed`, require a clean tracked and
non-ignored-untracked worktree before capture; if it is dirty, stop and ask the caller to choose
`TARGET=worktree` or provide a clean checkout. Never stash, discard, or hide local changes
automatically.

For either target, reject a tree where NUL-safe `git ls-files -v -z` reports any assume-unchanged or
skip-worktree entry. Compare every stage-zero path's indexed type/executable mode with its actual
filesystem state: `committed` requires equality, while `worktree` rejects any mismatch that
`change.patch` does not represent. Apply the same checks recursively inside every initialized
tracked submodule, then require its HEAD to equal the parent's indexed gitlink and its
`git status --porcelain=v1 --untracked-files=normal` to be empty; reject it otherwise. These gates
prevent Git hints, configuration, or nested changes from hiding tracked source state from the
review payload.

Create one fresh, run-unique directory under the operating system's temporary directory. Populate
the `loop-review-payload/v1` manifest and these fixed entries, then make the payload read-only:

- `commits.txt` — `git log <REVIEW_BASE>..<HEAD_OID> --oneline`.
- `change.patch` — for `committed`,
  `git diff --binary --full-index --no-ext-diff --no-textconv <REVIEW_BASE> <HEAD_OID> --`; for
  `worktree`, `git diff --binary --full-index --no-ext-diff --no-textconv <REVIEW_BASE> --`,
  including committed, staged, and unstaged tracked changes without changing the index.
- `untracked/<n>.blob` — for `worktree`, every path from the NUL-safe
  `git ls-files --others --exclude-standard -z`, sorted by path bytes and copied byte-for-byte. Copy
  a symlink's target bytes rather than following it. If an entry is a nested repository directory,
  recursively expand its HEAD-tree, index, and non-ignored-untracked union into full outer-relative
  paths; emit empty directory/deleted blobs plus every file or symlink leaf in bytewise path order,
  excluding nested Git metadata and ignored files.
- `specs/<n>` and `standards/<n>` — immutable bytes of every resolved spec and applicable
  documented-standard source.

Populate the manifest metadata from the resolved invocation and captured source. Record entries in
this order: commits, change, sorted untracked, specs, then standards.

Discover standards sources before selection: root instructions; nested instructions governing the
changed paths; contributor/coding-standard docs that declare themselves normative or are referenced
by those instructions; applicable lint/format configuration; and binding decision records. Discover
a spec from the caller first, then issue references in the commits and matching files under `docs/`,
`specs/`, or `.scratch/`. Record when either kind of ground truth is absent.

Compute the fingerprint before and after capture. If it differs, discard the payload and capture a
fresh one; do not combine evidence from two trees. At both boundaries, also require
`git rev-parse --verify HEAD` to equal `HEAD_OID`; otherwise restart from object-id pinning. Verify
the payload against the shared contract, then make the directory read-only. Selection and every
reviewer receive the same payload path and fingerprint. They may inspect surrounding repository
source only while that fingerprint remains current.

## 2. Select the applicable lenses

Read the pinned payload and write one concrete `run` or `skip` rationale for every lens. Select a
lens when it can answer a material question about this change:

| Lens | Agent | Applicability signal |
|---|---|---|
| Architecture | `architecture-review` | Module boundaries, public interfaces, dependency direction, seams, or domain structure change. |
| Documented rules | `rules-enforcer` | One or more captured repository or task rules apply to changed paths or decisions. |
| Correctness | `general-review` | Executable behaviour, data, configuration, build/release behaviour, operations, or safety can change. |
| Spec conformance | `spec-review` | A captured originating spec states intent that can be compared with the change. |
| Fowler smells | `smell-review` | Material handwritten code changed; generated/vendor content, lockfiles, prose, data-only, and purely mechanical edits do not qualify. |

Use judgment at the boundary; these are applicability signals, not quotas. Never run smell detection
inside documented-rule enforcement. A skipped lens is a visible decision, not a silent omission.

## 3. Preflight and spawn

Check that every **selected** agent type resolves. If a selected type is unavailable, stop before
spawning any reviewer and report it; an uninstalled skipped lens does not block the run.

Run the selected agents in the fewest capacity-aware parallel batches the current runtime permits;
never assume all five slots are available. Give each only the repository root, immutable payload
path, captured fingerprint, and a request to apply its resident lens. The agents already carry their
finding contract, so do not reproduce it. If no lens applies, return the five skip rationales without
spawning.

## 4. Validate and report

Recompute the source-tree fingerprint after the reviewers return. If it differs from the payload's
fingerprint, invalidate the entire review and report that the source changed; do not present stale
findings as current.

Report all five axes in this order — **Architecture**, **Documented rules**, **Correctness**,
**Spec conformance**, **Fowler smells**. Under each, show its `run` or `skip` rationale and either its
findings or `skipped`. Do not merge or rerank findings across lenses.
