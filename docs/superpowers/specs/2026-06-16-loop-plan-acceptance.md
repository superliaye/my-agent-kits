# loop-plan — acceptance

Verification is **structural + deploy-test** (per `@wf`: CC capabilities are
process-, not result-deterministic — assert structure, run the deploy/roundtrip
suite). All criteria are non-visual; there is **no visual block** (no UI).

> Note (Windows host): run isolated cases directly with `bash` — each case
> self-isolates `$HOME`/`USERPROFILE`. The full suite is
> `AGENT_KIT_TEST_HOST=1 bash test/run-tests.sh` (or `npm test` where Docker is
> available); a bare `npm run test:host` mis-parses the env prefix under cmd.

## Non-visual acceptance

- [ ] `@reviews` exists with all three agents; `@code-reviewers` is gone — verify:
  `test -d capabilities/agents/@reviews && ! test -d capabilities/agents/@code-reviewers && ls capabilities/agents/@reviews` lists `architecture-review rules-enforcer general-review`.
- [ ] The three agents keep their `name:` fields — verify:
  `for n in architecture-review rules-enforcer general-review; do grep -q "name: $n" capabilities/agents/@reviews/$n/AGENT.md || echo MISSING $n; done` prints nothing.
- [ ] No live (non-historical) reference to the old folder path remains — verify:
  `grep -rn "@code-reviewers" --include=*.md --include=*.sh --include=*.yaml . | grep -vE 'CHANGELOG\.md|docs/superpowers/specs/2026-06-15'` returns nothing.
- [ ] Each generalized agent body carries **both** contracts — verify:
  `for n in architecture-review rules-enforcer general-review; do grep -q "review-finding-contract" capabilities/agents/@reviews/$n/AGENT.md && grep -q "committee-answer-contract" capabilities/agents/@reviews/$n/AGENT.md || echo BAD $n; done` prints nothing.
- [ ] Snippet `committee-answer-contract.md` exists and defines the vote shape — verify:
  `test -f capabilities/snippets/committee-answer-contract.md && grep -qi "choice" capabilities/snippets/committee-answer-contract.md`.
- [ ] `grill-with-committee` SKILL.md exists, valid frontmatter (`name`, `description`,
  `added_in: 0.33.0`), and documents batch → vote → consensus → escalate — verify: file
  exists; `grep -q "added_in: 0.33.0"`; body mentions `"Other"`, consensus, and escalate.
- [ ] `loop-plan-manual` + `loop-plan-semiauto` SKILL.md exist with valid frontmatter;
  `-manual` references `grill-with-docs`, `-semiauto` references `grill-with-committee`;
  both reference `~/.loop-plan`, loop-build's two-block acceptance format, and
  stop-and-point (no auto-handoff) — verify: grep each SKILL.md for those terms.
- [ ] The three shared-phase snippets exist and are `<!-- include: -->`'d by **both**
  plan skills — verify: snippet files exist; `grep -c "<!-- include:" SKILL.md` > 0 in
  each plan skill.
- [ ] Snippet include resolution passes for the new snippets (no unknown markers; SKILL
  includes are strict) — verify: `node test/lib/snippet-includes.mjs` exits 0 with the
  new snippet checks added, or `bash test/cases/snippet-includes.sh` is green.
- [ ] Agents still deploy under their names from `@reviews`, finding-contract expanded —
  verify: `bash test/cases/agents-deploy.sh` passes.
- [ ] Manifest host/capability roundtrip still passes — verify:
  `bash test/cases/agents-update-roundtrip.sh` passes.
- [ ] The new skills are registered to deploy via a preset (or a new/extended case
  proves they deploy) — verify: `presets/loop-full-swe.yaml` lists the new skill names,
  and the relevant deploy case passes.
- [ ] `CHANGELOG.md` has a `0.33.0` entry covering loop-plan + the `@reviews` rename —
  verify: `grep -n "0.33.0" CHANGELOG.md`.
- [ ] Full suite green — verify: `AGENT_KIT_TEST_HOST=1 bash test/run-tests.sh` (or
  `npm test` under Docker) reports no failures.
