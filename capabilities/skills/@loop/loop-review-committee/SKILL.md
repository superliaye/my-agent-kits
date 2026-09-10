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
- **ACCEPTANCE CONTRACT ID** — optional SHA-256 of one separately supplied spec source; required
  when `/loop-build` invokes the committee.

Resolve omitted inputs without prompting:

- With neither input, use `BASE=HEAD`, `TARGET=worktree` when tracked or non-ignored untracked
  changes exist; otherwise use the remote default branch (falling back to `main`) and
  `TARGET=committed`.
- With only TARGET, use `BASE=HEAD` for `worktree`; for `committed`, use the remote default branch
  (falling back to `main`).
- With only BASE, use `TARGET=worktree` when tracked or non-ignored untracked changes exist and
  `TARGET=committed` otherwise.

Record the resolved values; never leave the target mode implicit.

<!-- include: review-payload-contract -->

## 1. Capture one immutable review payload

Pin `BASE_OID` with `git rev-parse --verify <BASE>^{commit}` and `HEAD_OID` with
`git rev-parse --verify HEAD`, then resolve `REVIEW_BASE` with
`git merge-base <BASE_OID> <HEAD_OID>`. Use only these object ids in later capture commands; fail on
a bad ref or empty selected change set. The target is the Git-visible change: `committed` reads only
the pinned commit objects; `worktree` reads the tracked diff plus non-ignored untracked paths that
Git reports. Local state hidden from Git is outside the review. Never modify the index or worktree
while capturing it.

Create one fresh, run-unique directory under the operating system's temporary directory. Populate
the `loop-review-payload/v2` manifest and these fixed entries, then make the payload read-only:

- `commits.txt` — `git log <REVIEW_BASE>..<HEAD_OID> --oneline`.
- `change.patch` — for `committed`,
  `git diff --binary --full-index --no-ext-diff --no-textconv <REVIEW_BASE> <HEAD_OID> --`; for
  `worktree`, `git diff --binary --full-index --no-ext-diff --no-textconv <REVIEW_BASE> --`,
  including committed, staged, and unstaged tracked changes without changing the index.
- `untracked/<n>.blob` — for `worktree`, every path from the NUL-safe
  `git ls-files --others --exclude-standard -z`, sorted by path bytes and copied byte-for-byte. Copy
  a symlink's target bytes rather than following it; record a returned directory without expanding
  nested repository contents that the outer repository does not report.
- `specs/<n>` and `standards/<n>` — immutable bytes of every resolved spec and applicable
  documented-standard source. Read repository paths from `HEAD_OID`; for `worktree`, capture the
  worktree state instead when that path is part of the captured change.

Populate the manifest metadata from the resolved invocation and captured source. Record entries in
this order: commits, change, sorted untracked, specs, then standards.

When `ACCEPTANCE CONTRACT ID` is present, require a captured spec entry with that exact `sha256`.
Return `stale-contract` before reviewer selection when none matches; the live path or inline content
has moved away from the contract whose evidence passed.

Discover repository standards from the pinned `HEAD_OID` tree and, for `worktree`, every path in the
captured patch or untracked entries before selection: root instructions; nested instructions
governing the changed paths; contributor/coding-standard docs that declare themselves normative or
are referenced by those instructions; applicable lint/format configuration; and binding decision
records. Discover a spec from the caller first, then issue references in the commits and matching
files under `docs/`, `specs/`, or `.scratch/`. Record when either kind of ground truth is absent.

Immediately recapture the selected change. For `committed`, require `HEAD` still to equal `HEAD_OID`.
For `worktree`, also require the same `HEAD`, byte-identical `change.patch`, and the same sorted
untracked paths, types, modes, and bytes. If any differ, discard the payload and start capture again;
do not combine evidence from two states. Verify the payload against the shared contract, then make
the directory read-only.

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
path, and a request to apply its resident lens. The agents already carry their finding contract, so
do not reproduce it. If no lens applies, return the five skip rationales without spawning.

## 4. Validate and report

Repeat the same recapture check after the reviewers return. If the selected commit or Git-visible
worktree change differs from the payload, invalidate the entire review and report that the change
set moved; do not present stale findings as current.

Report all five axes in this order — **Architecture**, **Documented rules**, **Correctness**,
**Spec conformance**, **Fowler smells**. Under each, show its `run` or `skip` rationale and either its
findings or `skipped`. Do not merge or rerank findings across lenses.
