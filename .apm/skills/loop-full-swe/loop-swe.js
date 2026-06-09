// loop-swe — the shared dynamic-workflow engine behind 4 skills:
//   /loop-full-swe       full run (scope -> retro), brokers conditional gates
//   /loop-research-plan  this engine with {stopAfter:'plan'}
//   /loop-build          this engine with {startFrom:'build'}
//   /loop-retro          this engine with {startFrom:'retro'}
// All four launch THIS file via Workflow({scriptPath, args}); it is the single
// source of truth. The 3 sub-skills resolve it at ../loop-full-swe/loop-swe.js.
//
// Design rules (forced by the runtime):
//  * Subagents cannot spawn subagents (depth=1, per code.claude.com/docs/en/sub-agents).
//    So ALL fan-out lives in THIS script (a root orchestrator). Every agent() below
//    is a LEAF: one job, schema return, never spawns. Nested fan-out is lifted up
//    here, never pushed into a worker.
//  * Autonomous by default. A self-digest agent splits every open question into
//    auto-resolved vs genuinely-needs-human. The run only STOPS (returns a `gate`)
//    when needsHuman is non-empty; otherwise it proceeds on its own.
//  * The main agent (the uber skill) brokers human breaks BETWEEN runs: it reads
//    the returned needsHuman, asks you, then resumes via resumeFromRunId with
//    args.resolutions — cached phases replay instantly, the digest now passes.
//
// args:
//   feature      string  the request (required for a fresh run)
//   startFrom    'scope'(default)|'plan'|'build'|'retro'  first phase to run
//   stopAfter    'plan'|'build'|'retro'(default)          last phase to run
//   resolutions  { [questionId]: humanAnswer }            injected on a gated resume

export const meta = {
  name: 'loop-full-swe',
  description: 'Autonomous architecture-aware SWE loop: scope-gate -> survey/plan -> implement + multi-perspective review -> summary/retro. Self-digesting (only surfaces decisions that need a human); leaf-only orchestration (subagent-nesting safe); budget-scaled; resumable.',
  phases: [{ title: 'Scope' }, { title: 'Plan' }, { title: 'Build' }, { title: 'Retro' }],
}

// The harness may deliver `args` as a JSON string rather than a parsed object; normalize first.
const ARGS = typeof args === 'string' ? JSON.parse(args) : (args ?? {})
const FEATURE = ARGS.feature ?? ''
const START = ARGS.startFrom ?? 'scope'
const STOP = ARGS.stopAfter ?? 'retro'
const RES = ARGS.resolutions ?? {}
const ORDER = ['scope', 'plan', 'build', 'retro']
const runs = (p) => ORDER.indexOf(p) >= ORDER.indexOf(START) && ORDER.indexOf(p) <= ORDER.indexOf(STOP)
const unresolved = (qs) => (qs ?? []).filter((q) => !(q.id in RES))
// ---- schemas (force StructuredOutput; no regex parsing of free text) --------
const ROOT = { type: 'object', additionalProperties: false, required: ['root'], properties: { root: { type: 'string' } } }
const QUESTION = {
  type: 'object', additionalProperties: false,
  required: ['id', 'question', 'recommendation', 'reversibility'],
  properties: {
    id: { type: 'string' }, question: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } },
    recommendation: { type: 'string' },
    reversibility: { type: 'string', enum: ['easy', 'moderate', 'hard'] },
  },
}
const SCOPE = {
  type: 'object', additionalProperties: false,
  required: ['track', 'uiWork', 'tooLargeForOneRun', 'rationale'],
  properties: {
    track: { type: 'string', enum: ['trivial', 'standard', 'architectural'] },
    uiWork: { type: 'boolean' }, tooLargeForOneRun: { type: 'boolean' }, rationale: { type: 'string' },
  },
}
const PLAN = {
  type: 'object', additionalProperties: false,
  required: ['items', 'openQuestions', 'touchesPublicSurface'],
  properties: {
    items: {
      type: 'array', items: {
        type: 'object', additionalProperties: false, required: ['id', 'summary'],
        properties: { id: { type: 'string' }, summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, successCriteria: { type: 'string' } },
      },
    },
    openQuestions: { type: 'array', items: QUESTION },
    touchesPublicSurface: { type: 'boolean' },
  },
}
const DIGEST = {
  type: 'object', additionalProperties: false,
  required: ['autoResolved', 'needsHuman'],
  properties: {
    autoResolved: {
      type: 'array', items: {
        type: 'object', additionalProperties: false, required: ['id', 'decision', 'why'],
        properties: { id: { type: 'string' }, decision: { type: 'string' }, why: { type: 'string' } },
      },
    },
    needsHuman: { type: 'array', items: QUESTION },
  },
}
const VALIDATE = {
  type: 'object', additionalProperties: false, required: ['status'],
  properties: { status: { type: 'string', enum: ['passing', 'code-errors', 'requirements-unmet', 'no-harness'] }, detail: { type: 'string' } },
}
const FINDINGS = {
  type: 'object', additionalProperties: false, required: ['findings'],
  properties: {
    findings: {
      type: 'array', items: {
        type: 'object', additionalProperties: false, required: ['title', 'severity', 'evidence', 'fix'],
        properties: { title: { type: 'string' }, severity: { type: 'string', enum: ['high', 'medium', 'low'] }, evidence: { type: 'string' }, fix: { type: 'string' } },
      },
    },
  },
}
const VERDICT = {
  type: 'object', additionalProperties: false, required: ['confirmed', 'disposition', 'why'],
  properties: { confirmed: { type: 'boolean' }, disposition: { type: 'string', enum: ['auto-apply', 'auto-skip', 'needs-human'] }, why: { type: 'string' } },
}
// Issue contract for the decomposition gate. Cross-element invariants the JSON schema can't encode are
// enforced by the breakdown prompt below: ids are unique, every dependsOn entry references an existing id
// in this set, and the dependency graph is acyclic (so the continue-after-decomposition runbook can topo-sort).
const ISSUES = {
  type: 'object', additionalProperties: false, required: ['issues'],
  properties: {
    issues: {
      type: 'array', items: {
        type: 'object', additionalProperties: false, required: ['id', 'title', 'body'],
        properties: { id: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, dependsOn: { type: 'array', items: { type: 'string' } } },
      },
    },
  },
}
const SUMMARY = { type: 'object', additionalProperties: false, required: ['markdown', 'runDir'], properties: { markdown: { type: 'string' }, runDir: { type: 'string' } } }

// ===========================================================================
// Artifact root: a per-repo folder under the user's home dir, NEVER the working tree —
// so a run never dirties git or needs a .gitignore entry. Host-neutral on purpose (NOT under
// ~/.claude or ~/.codex): the kit targets multiple hosts, and run-scratch is not agent config.
// The script can't touch the fs (no Date/random/git), so one leaf resolves the path ONCE and we
// thread it through every later prompt. The recipe is deterministic per repo, so loop-build's
// pre-write step and a later /loop-retro resolve the SAME folder (see each SKILL.md's note).
const rootRes = await agent(
  `Resolve and create the loop-swe artifact root, then return it. It is a per-repo folder under the
user's home directory — host-neutral, do NOT put it under ~/.claude, ~/.codex, or the working tree:
  HOME = $HOME (or %USERPROFILE% on Windows when $HOME is unset)
  KEY  = the absolute path from \`git rev-parse --show-toplevel\`, trimmed of trailing whitespace,
         lowercased, with every character outside [a-z0-9] replaced by "-" (e.g. "D:/Repos/My-App"
         -> "d--repos-my-app"). A deterministic slug, NO hashing — the other loop skills reproduce this
         exact rule, so keep it character-for-character.
  ROOT = "<HOME>/.loop-swe/<KEY>"
Run \`mkdir -p\` on ROOT. Write nothing else. Return { root: "<absolute ROOT>" }.
You are a LEAF agent: do your one job; you may NOT spawn sub-agents.`,
  { label: 'resolve-root', schema: ROOT })
const A = rootRes.root

// Injected into every leaf prompt: the no-spawn rule + the escalation discipline.
const DISC = `
You are a LEAF agent: do your one job and return your result; you may NOT spawn sub-agents.
Escalation discipline — before flagging anything as needing a human, check, in order:
~/.claude/CLAUDE.md, <repo>/CLAUDE.md, <repo>/CONTEXT.md, <repo>/docs/adr/, <repo>/docs/, and prior
artifacts under ${A}/. Escalate ONLY what those genuinely do not answer. Write artifacts under ${A}/ only.`

let scope = { track: 'standard', uiWork: false, tooLargeForOneRun: false }
let plan = null

// ---- Phase 0: Scope gate (read-only Explore leaf) -------------------------
// Runs whenever plan OR build will run, so a standalone /loop-build still knows
// track + uiWork. Skipped only for a retro-only run.
if (runs('plan') || runs('build')) {
  phase('Scope')
  scope = await agent(
    `Scope this request: "${FEATURE}". Read the repo + project docs. Decide: track (trivial ~<5 files & no
architectural impact | standard | architectural cross-cutting/new-boundary); uiWork (touches UI?);
tooLargeForOneRun (really several features that should be separate issues?).${DISC}`,
    { label: 'scope', phase: 'Scope', schema: SCOPE, agentType: 'Explore' })
  log(`track=${scope.track} ui=${scope.uiWork} tooLarge=${scope.tooLargeForOneRun}`)
  // Only fresh planning runs may bail out to issue-distribution; a resumed build never does.
  if (scope.tooLargeForOneRun && runs('plan')) {
    const bd = await agent(
      `Too large for one build. Decompose "${FEATURE}" into independent, sequenced issues. Each issue needs a
short stable kebab-case \`id\` (e.g. "auth-schema"), a \`title\`, a \`body\`, and an optional \`dependsOn\`
array whose entries are the \`id\`s of the issues it depends on (reference ids, not titles). Invariants:
ids are unique, every \`dependsOn\` entry references an existing id in this set, and the dependency graph
is acyclic. Implement nothing.${DISC}`,
      { label: 'breakdown', phase: 'Scope', schema: ISSUES })
    return { gate: 'distribute-to-issues', scope, artifactRoot: A, issues: bd.issues, note: 'Feed these to /to-issues, then /loop-full-swe each.' }
  }
}

// ---- Phase 1: Survey + Plan, then self-digest -----------------------------
if (runs('plan')) {
  phase('Plan')
  plan = await agent(
    `Survey-grade plan for: "${FEATURE}" (track=${scope.track}). Be more cautious than ordinary plan mode:
map affected architecture with file:line evidence, give success criteria per item, and surface EVERY
genuine open question (options + your recommendation + reversibility). Write ${A}/plan.md and, unless
track=trivial, ${A}/architecture-impact.md.${DISC}`,
    { label: 'plan', phase: 'Plan', schema: PLAN })
  const digest = await agent(
    `Self-digest the plan's open questions. Human answers so far: ${JSON.stringify(RES)}. For each question:
if it is already answered there, put it in autoResolved with decision = the human's directive (verbatim
intent); else if the escalation/doc sources answer it, put it in autoResolved with that decision; else keep
it in needsHuman. Questions: ${JSON.stringify(plan.openQuestions)}. Put ONLY genuinely unresolved,
consequential questions in needsHuman.${DISC}`,
    { label: 'plan-digest', phase: 'Plan', schema: DIGEST })
  const open = unresolved(digest.needsHuman)
  if (open.length) return { gate: 'plan', scope, plan, artifactRoot: A, autoResolved: digest.autoResolved, needsHuman: open, note: 'Resolve, then resume; planning is cached.' }
  // Operator-resolved questions must reach the plan the build implements, not just clear the gate.
  const resIds = new Set(Object.keys(RES))
  const planResolved = (digest.autoResolved || []).filter((x) => resIds.has(x.id))
  if (planResolved.length) await agent(
    `Bake these operator decisions into ${A}/plan.md before the build reads it — they are BINDING: reflect
each fully in the affected items and success criteria, do NOT narrow them. Decisions:
${JSON.stringify(planResolved)}${DISC}`,
    { label: 'plan-resolve', phase: 'Plan' })
  log(`plan clear: ${plan.items.length} items, ${digest.autoResolved.length} auto-resolved`)
}
if (STOP === 'plan') return { gate: 'plan-done', scope, plan, artifactRoot: A }

// ---- Phase 2: Build = implement + multi-perspective review, budget-bounded -
let buildOpen = [], lastVal = null
if (runs('build')) {
  const REVIEWERS = [
    { key: 'architecture', skill: '/improve-codebase-architecture' },
    { key: 'ddd', skill: '/improve-DDD-architecture' },
    { key: 'general', skill: null },
    ...(scope.uiWork ? [{ key: 'design', skill: '/design-critique' }] : []),
  ]
  const cap = budget.total ? Math.max(1, Math.min(3, Math.floor(budget.remaining() / 150_000))) : 3
  let round = 0, settled = false
  while (!settled && round < cap) {
    round++
    phase(`Build r${round}`)
    await agent(
      `Round ${round}: implement all still-pending items in ${A}/plan.md (read from disk). Items flagged as
operator decisions are BINDING — implement them in full as written; do NOT reduce their scope citing
minimalism, and if one is genuinely infeasible, record that as an open question rather than silently
delivering less. Record the pre-change HEAD sha to ${A}/round-${round}/start-sha, commit per logical
chunk, write ${A}/round-${round}/status.md. If a step is not unambiguously executable, do NOT invent —
record it as an open question in ${A}/round-${round}/questions.md.${DISC}`,
      { label: `implement-r${round}`, phase: `Build r${round}` })
    const val = await agent(
      `Round ${round}: invoke /e2e-validate (chunk mode) via Skill. Verify the code RUNS and meets the
plan's success criteria. Write ${A}/round-${round}/validation.md.${DISC}`,
      { label: `validate-r${round}`, phase: `Build r${round}`, schema: VALIDATE })
    lastVal = val
    if ((val.status === 'code-errors' || val.status === 'requirements-unmet') && round < cap) continue

    // multi-perspective review (parallel leaves) -> adversarial verify per finding (pipeline)
    const reviews = await parallel(REVIEWERS.map((r) => () =>
      agent(
        `Round ${round} ${r.key} review of the diff since ${A}/round-${round}/start-sha.
${r.skill ? `Invoke ${r.skill} via Skill.` : 'Review the diff directly.'} Return findings only.${DISC}`,
        { label: `review:${r.key}`, phase: `Build r${round}`, schema: FINDINGS })))
    // Index against the UNFILTERED reviews so REVIEWERS[i] stays aligned when a reviewer leaf died (null).
    // Anchor the finding id here (a cached step) so a gated resume matches it; the digest must not re-mint it.
    const findings = reviews.flatMap((r, i) => (r?.findings || []).map((f, j) => ({ ...f, reviewer: REVIEWERS[i].key, id: `r${round}-${REVIEWERS[i].key}-${j}` })))
    const verified = await pipeline(findings, (f) =>
      agent(
        `Adversarially verify this ${f.reviewer} finding against the actual diff. Is it real? Then disposition:
auto-apply (clear win) | auto-skip (noise/out-of-scope) | needs-human (taste/irreversible/ambiguous).
Default to skepticism.\nFinding: ${JSON.stringify(f)}${DISC}`,
        { label: `verify:${f.reviewer}`, phase: `Build r${round}`, schema: VERDICT }).then((v) => ({ ...f, ...v })))
    const real = verified.filter(Boolean).filter((f) => f.confirmed)
    const toApply = real.filter((f) => f.disposition === 'auto-apply')
    const human = real.filter((f) => f.disposition === 'needs-human')

    let resolvedHuman = []
    if (human.length) {     // self-digest the review escalations, same gate as the plan
      const d = await agent(
        `Self-digest these needs-human review findings. Human answers so far: ${JSON.stringify(RES)}. For
each finding: if it is already answered there, put it in autoResolved with decision = the human's directive
(verbatim intent); else if the docs/escalation sources answer it, put it in autoResolved with that
decision; else keep it in needsHuman. Use each finding's \`id\` verbatim as the entry id (in autoResolved
AND needsHuman) — NEVER mint a new one, so a gated resume matches the human's answer. Findings:
${JSON.stringify(human)}.${DISC}`,
        { label: `review-digest-r${round}`, phase: `Build r${round}`, schema: DIGEST })
      buildOpen = unresolved(d.needsHuman)
      if (buildOpen.length) return { gate: 'build', scope, round, artifactRoot: A, needsHuman: buildOpen, autoApplied: toApply.length, note: 'Resolve, then resume; prior rounds are cached.' }
      // Operator-resolved findings (now in autoResolved) must change code, not just clear the gate:
      // fold each into a pending fix so the next round implements it.
      const resIds = new Set(Object.keys(RES))
      resolvedHuman = (d.autoResolved || []).filter((x) => resIds.has(x.id)).map((x) => ({ title: x.decision, severity: 'high', evidence: 'operator resolution', fix: x.decision, reviewer: 'human-resolution' }))
    }
    const nextItems = [...toApply, ...resolvedHuman]
    if (!nextItems.length) { settled = true; break }
    // autonomously incorporate confirmed fixes + operator-resolved decisions: append to plan.md for the next round
    await agent(
      `Append these as new pending items to ${A}/plan.md so the next round implements them. Items tagged
reviewer="human-resolution" are explicit OPERATOR decisions — flag them as operator decisions and
implement in full, do not narrow:
${JSON.stringify(nextItems)}${DISC}`,
      { label: `incorporate-r${round}`, phase: `Build r${round}` })
    log(`round ${round}: applied ${nextItems.length} fix(es), looping`)
  }
}
if (STOP === 'build') return { gate: 'build-done', scope, buildOpen, artifactRoot: A, validation: lastVal }

// ---- Phase 3: Summary + Retro ---------------------------------------------
// Per-run folder so successive runs don't overwrite each other's reflections. The script can't
// generate a key (no Date/random), so the summary leaf derives one from `git rev-parse --short HEAD`,
// creates the folder (suffixing on collision), and RETURNS it — the retro leaf reuses that exact path
// instead of independently re-deriving it.
phase('Retro')
const summary = await agent(
  `Resolve a per-run folder RUN_DIR = ${A}/runs/<id>, where <id> is \`git rev-parse --short HEAD\` (append
"-2", "-3", ... if that folder already exists, so successive runs at the same HEAD don't overwrite). Create
it, then write RUN_DIR/summary.md: request, track, what was built, rounds taken, findings breakdown, status,
and the list of decisions auto-resolved without the human (so they can be audited). Return the markdown and
the absolute RUN_DIR as \`runDir\`.${DISC}`,
  { label: 'summary', phase: 'Retro', schema: SUMMARY })
await agent(
  `Retro: mine this run for stalls, repeated failures, avoidable escalations, token waste, and what worked.
Write ${summary.runDir}/reflection.md + ${summary.runDir}/reflection.patch (the run folder the summary leaf
returned; proposals for CLAUDE.md / the skills / docs). Do NOT apply the patch.${DISC}`,
  { label: 'retro', phase: 'Retro' })

return { gate: 'done', scope, artifactRoot: A, validation: lastVal, summaryMarkdown: summary.markdown, note: `Code committed; per-run reflection.patch under ${A}/runs/ (a user-folder cache outside the repo) left for review.` }
