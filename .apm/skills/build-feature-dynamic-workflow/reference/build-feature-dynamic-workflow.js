// =============================================================================
// build-feature-dynamic-workflow — REFERENCE SEED  (NOT a known-good script)
// =============================================================================
//
// UNVERIFIED API. As of 2026-05-29 the Claude Code dynamic-workflow scripting
// API (the agent/phase/parallel primitives, the entrypoint signature, the
// .claude/workflows/*.js file shape) is NOT publicly documented:
//   https://code.claude.com/docs/en/workflows
//
// The symbol names below (`agent()`, the default-export signature, the result
// shape) are BEST-GUESSES so the phase logic is captured in code. They are very
// likely wrong in detail. Do NOT assume this runs as-is.
//
// To get a correct script: run `/build-feature-dynamic-workflow <feature>`
// (Mode A — the assistant hands workflow-spec.md to the runtime, which writes
// the real script), let it run, then `/workflows` → select the run → `s` to
// save the runtime's generated script. Diff THAT against this file and keep the
// runtime's version. This seed is a structural template, not the source of truth.
//
// Source of truth for behavior: ../workflow-spec.md
// =============================================================================

const ARTIFACTS = ".build-feature-dynamic-workflow";
const MAX_ROUNDS = 3; // implement/validate + triage fix loops (matches bash outer cap)

// Disciplines injected into every phase prompt. See workflow-spec.md.
const DISCIPLINES = `
Decisions protocol (no mid-run pause): before recording an open decision, check
~/.claude/CLAUDE.md, <repo>/CLAUDE.md, CONTEXT.md, docs/adr/, docs/, and prior
artifacts under ${ARTIFACTS}/. Only if the answer is genuinely absent, append to
${ARTIFACTS}/decisions.md a block with: the question, "checked against: <docs>;
not found", the assumption you proceeded with, and reversibility. Then continue.
Research delegation: SMALL (one source) inline with cited URL; SIZABLE
(multi-source synthesis) delegate to a research subagent that writes
${ARTIFACTS}/research/<slug>.md only.
`;

export default async function buildFeatureDynamicWorkflow({ agent, args }) {
  const feature = args?.text ?? args ?? "";

  // --- Phase 1: Plan (architecture-aware) ---
  const plan = await agent({
    name: "phase1-plan",
    tools: ["Read", "Glob", "Grep", "Write", "WebSearch", "WebFetch"],
    prompt: `Phase 1 — architecture-aware planning for: ${feature}
Determine what this change MEANS to the existing architecture (no-impact /
doable / requires-shift). Write ${ARTIFACTS}/research.md, repo-profile.md
(file:line evidence), architecture-impact.md, and plan.md (chunked steps +
success criteria + REVIEW: markers). Decide ui_work and end your reply with a
line "ui_work: true" or "ui_work: false".${DISCIPLINES}`,
  });
  const uiWork = /ui_work:\s*true/i.test(plan.result ?? "");

  // --- Phase 2: Plan review (separate context) ---
  await agent({
    name: "phase2-plan-review",
    tools: ["Read", "Glob", "Grep", "Write"],
    prompt: `Phase 2 — independently review ${ARTIFACTS}/plan.md REVIEW: markers
against Phase 1 artifacts + project docs (NOT Phase 1's narrative). Resolve in
place (CLOSE) or record via the Decisions protocol.${DISCIPLINES}`,
  });

  // --- Phase 3: Design (only if ui_work) ---
  if (uiWork) {
    await agent({
      name: "phase3-design",
      tools: ["Read", "Glob", "Grep", "Write", "Skill"],
      prompt: `Phase 3 — discover and invoke the installed design skill
(ui-ux-pro-max, else frontend-design / design-critique) via the Skill tool,
follow its protocol inline, emit ${ARTIFACTS}/design-brief.md. Encode no design
opinions yourself. Design REVIEW items → Decisions protocol.${DISCIPLINES}`,
    });
  }

  // --- Phases 4–7: implement → validate → review → triage, bounded loop ---
  let round = 0;
  let stable = false;
  while (!stable && round < MAX_ROUNDS) {
    round++;
    const batch = `${ARTIFACTS}/round-${round}`;

    // Phase 4 — bulk implement
    await agent({
      name: `phase4-implement-r${round}`,
      tools: ["Read", "Glob", "Grep", "Edit", "Write", "Bash"],
      prompt: `Phase 4 (round ${round}) — implement all pending plan items as one
batch from ${ARTIFACTS}/plan.md (+ architecture-impact.md${uiWork ? " + design-brief.md" : ""}).
Commit per logical chunk. Write ${batch}/status.md. If a step is not
unambiguously executable, do NOT invent — apply the Decisions protocol. Read
prior ${ARTIFACTS}/round-* dirs; if you are repeating a failed approach, stop and
record an open decision instead.${DISCIPLINES}`,
    });

    // Phase 5 — e2e validate (with inner retry to Phase 4, bounded by the loop)
    const validate = await agent({
      name: `phase5-validate-r${round}`,
      tools: ["Read", "Glob", "Grep", "Skill", "Write", "Bash"],
      prompt: `Phase 5 (round ${round}) — invoke /e2e-validate (chunk mode) via
Skill. Verify the code RUNS and meets Phase 1 success criteria. Write
${batch}/validation-report.md. End with exactly one status line:
"status: Passing" | "status: Code Errors" | "status: Requirements Unmet" |
"status: No Harness".${DISCIPLINES}`,
    });
    const status = (validate.result ?? "").match(/status:\s*([^\n]+)/i)?.[1]?.trim() ?? "";
    if (/Code Errors|Requirements Unmet/i.test(status) && round < MAX_ROUNDS) {
      continue; // loop back to Phase 4
    }

    // Phase 6 — three parallel reviewers
    await Promise.all([
      agent({
        name: `phase6-arch-r${round}`,
        tools: ["Read", "Glob", "Grep", "Bash", "Write", "Skill"],
        prompt: `Phase 6 architecture review (round ${round}) — invoke
/improve-codebase-architecture on git diff <phase4-start-sha>..HEAD. Write
${batch}/review/architecture-review.md. Raw findings, no scoring.${DISCIPLINES}`,
      }),
      agent({
        name: `phase6-ddd-r${round}`,
        tools: ["Read", "Glob", "Grep", "Bash", "Write", "Skill"],
        prompt: `Phase 6 DDD review (round ${round}) — invoke
/improve-DDD-architecture on the same diff. Write ${batch}/review/ddd-review.md.${DISCIPLINES}`,
      }),
      agent({
        name: `phase6-general-r${round}`,
        tools: ["Read", "Glob", "Grep", "Bash", "Write"],
        prompt: `Phase 6 general review (round ${round}) — review the diff
directly. Write ${batch}/review/general-review.md.${DISCIPLINES}`,
      }),
    ]);

    // Phase 7 — triage (no-narrative). Reports whether any AUTO_APPLY remain.
    const triage = await agent({
      name: `phase7-triage-r${round}`,
      tools: ["Read", "Glob", "Grep", "Write"],
      prompt: `Phase 7 triage (round ${round}) — from ${batch}/review/*.md +
Phase 1 artifacts + CLAUDE.md/CONTEXT.md/docs/adr/ ONLY (no implementer
narrative). Per finding: AUTO_APPLY (schedule a fix in plan.md with finding +
source file + justification), AUTO_SKIP (record in ${batch}/triage.md), or
escalate via Decisions protocol. End with "auto_apply_count: <N>".${DISCIPLINES}`,
    });
    const autoApply = parseInt((triage.result ?? "").match(/auto_apply_count:\s*(\d+)/i)?.[1] ?? "0", 10);
    stable = autoApply === 0;
  }

  // --- Phase 8: Design critique (only if ui_work) — Phase 7's UI twin ---
  if (uiWork) {
    let dRound = 0;
    let dStable = false;
    while (!dStable && dRound < MAX_ROUNDS) {
      dRound++;
      const dc = await agent({
        name: `phase8-design-critique-r${dRound}`,
        tools: ["Read", "Glob", "Grep", "Write", "Skill", "Bash"],
        prompt: `Phase 8 design critique (round ${dRound}) on the FINAL
post-triage code. Same trichotomy on design dimensions (hierarchy, a11y, brand,
interaction polish). May invoke /e2e-validate for re-screenshots. AUTO_APPLY
fixes go through implement+validate again. End with "auto_apply_count: <N>".${DISCIPLINES}`,
      });
      dStable = parseInt((dc.result ?? "").match(/auto_apply_count:\s*(\d+)/i)?.[1] ?? "0", 10) === 0;
    }
  }

  // --- Phase 9: Documentation ---
  await agent({
    name: "phase9-documentation",
    tools: ["Read", "Glob", "Grep", "Edit", "Write", "Bash"],
    prompt: `Phase 9 — update ADRs / C4 / DESIGN.md per Phase 1's diagram delta
to match what shipped.${DISCIPLINES}`,
  });

  // --- Phase 10: Summary + render Open decisions report ---
  const summary = await agent({
    name: "phase10-summary",
    tools: ["Read", "Glob", "Grep", "Bash", "Write"],
    prompt: `Phase 10 — write ${ARTIFACTS}/summary.md: request / what was built /
rounds taken / findings breakdown / status. Then render
${ARTIFACTS}/decisions.md as the Open decisions report. Return both in your reply.`,
  });

  // --- Phase 11: Reflection (proposes, never applies) ---
  await agent({
    name: "phase11-reflection",
    tools: ["Read", "Glob", "Grep", "Bash", "Write"],
    prompt: `Phase 11 — mine this run for stalls, repeated failures, avoidable
open decisions, token waste, missing context, and what worked. Write
${ARTIFACTS}/reflection.md + reflection.patch + reflection-watchlist.md. Do NOT
apply the patch.`,
  });

  return summary.result;
}
