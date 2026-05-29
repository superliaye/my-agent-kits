#!/usr/bin/env bash
# Workflow orchestrator — state-machine test suite.
#
# Drives `.apm/skills/workflow/orchestrator.sh` with mocked phase
# agents (see test/lib/workflow-fixture-runner.sh). Each sub-test
# defines a queue of fixture responses, runs the orchestrator, then
# asserts on the resulting trace + state file.
#
# Covers the state-machine invariants and liveness scenarios in
# docs/design/workflow-state-machine.md §5–§6. Coverage is selective
# (not exhaustive over every combinatorial path) but exercises every
# locked invariant and the highest-risk liveness paths.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"
. "$KIT_ROOT/.apm/skills/workflow/lib/state-ops.sh"

ORCH="$KIT_ROOT/.apm/skills/workflow/orchestrator.sh"
RUNNER="$KIT_ROOT/test/lib/workflow-fixture-runner.sh"

# Guard: surface the missing-orchestrator failure clearly rather than
# crashing every sub-test with the same exec error.
if [ ! -x "$ORCH" ] && [ ! -f "$ORCH" ]; then
  fail "orchestrator.sh not present at $ORCH — every state-machine case will fail until it is built"
fi
if [ ! -f "$RUNNER" ]; then
  fail "workflow-fixture-runner.sh missing at $RUNNER"
fi

# ----------------------------------------------------------------------
# Test scaffolding
# ----------------------------------------------------------------------

# wf_init <test-name>
# Creates an isolated workspace under $WORK_BASE/<name>/ with:
#   .workflow/        (consumed by orchestrator)
#   fixtures/         (response scripts, NNN.sh)
#   trace.log         (dispatch log)
# Exports state needed by the runner.
WORK_BASE="$(mktemp -d)"
trap "rm -rf '$WORK_BASE'" EXIT

wf_init() {
  TEST_NAME="$1"
  TEST_WORK="$WORK_BASE/$TEST_NAME"
  mkdir -p "$TEST_WORK/.workflow" "$TEST_WORK/fixtures"
  : > "$TEST_WORK/trace.log"
  printf '0\n' > "$TEST_WORK/fixtures/.counter"
  export WORKFLOW_FIXTURE_DIR="$TEST_WORK/fixtures"
  export WORKFLOW_TRACE_FILE="$TEST_WORK/trace.log"
  export WORKFLOW_TEST_DISPATCH_HOOK="$RUNNER"
  STATE_FILE_PATH="$TEST_WORK/.workflow/state.md"
}

# wf_enqueue
# Appends the heredoc on stdin as the next fixture response. Auto-numbered.
wf_enqueue() {
  local n
  n=$(ls "$WORKFLOW_FIXTURE_DIR"/[0-9]*.sh 2>/dev/null | wc -l | tr -d ' ')
  n=$((n + 1))
  local f
  f="$WORKFLOW_FIXTURE_DIR/$(printf '%03d' "$n").sh"
  cat > "$f"
  chmod +x "$f"
}

wf_run_fresh() {
  local req="$1"
  # On a fresh invocation, the orchestrator bootstraps state.md from
  # --user-request.
  bash "$ORCH" --workdir "$TEST_WORK/.workflow" --user-request "$req"
}

wf_run_resume() {
  local prompt="${1:-}"
  if [ -n "$prompt" ]; then
    bash "$ORCH" --workdir "$TEST_WORK/.workflow" --user-prompt "$prompt"
  else
    bash "$ORCH" --workdir "$TEST_WORK/.workflow"
  fi
}

wf_seed_state() {
  # Write a pre-built state file from stdin. Used for tests that don't
  # start from bootstrap.
  cat > "$STATE_FILE_PATH"
}

wf_trace() {
  cat "$WORKFLOW_TRACE_FILE"
}

# wf_trace_phases -> "1 2 4 5 6 7 9 10 11" style summary
wf_trace_phases() {
  awk '{ for(i=1;i<=NF;i++){ if ($i ~ /^phase=/){ sub(/^phase=/,"",$i); printf "%s%s", (n++?" ":""), $i } } }' "$WORKFLOW_TRACE_FILE"
  echo
}

# ----------------------------------------------------------------------
# Reusable fixture writers
# ----------------------------------------------------------------------

# A fixture is just a bash snippet that rewrites $STATE_FILE. To keep
# the test cases readable we factor out the most common payload shapes
# into helper functions invoked from inside the fixture heredoc.

emit_state_phase1_done_non_ui() {
  cat <<'STATE'
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan for: test request
---
id: item-002
tag: to-review-plan
status: pending
emitted-by-phase: 1
artifact:
permissions:
parent: item-001
title: REVIEW: confirm approach
---
id: item-010
tag: to-implement
status: pending
emitted-by-phase: 1
artifact: .workflow/plan.md#step-1
permissions:
parent: item-001
title: Phase 4: implement step 1
---
STATE
}

emit_state_phase2_done_no_humans() {
  cat <<'STATE'
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan for: test request
---
id: item-002
tag: to-review-plan
status: done
emitted-by-phase: 1
artifact: .workflow/plan.md#review-1
permissions:
parent: item-001
title: REVIEW: confirm approach
---
id: item-010
tag: to-implement
status: pending
emitted-by-phase: 1
artifact: .workflow/plan.md#step-1
permissions:
parent: item-001
title: Phase 4: implement step 1
---
STATE
}

# ======================================================================
# CASE 1 — Bootstrap fresh start writes initial state
# ======================================================================
case_bootstrap() {
  wf_init bootstrap

  # Phase 1 fixture: just exit successfully (we don't care about the
  # state mutation for this test — we're asserting on what the
  # bootstrap wrote BEFORE the first dispatch).
  wf_enqueue <<'RESP'
# Phase 1 fixture — terminate the loop by leaving state acceptable.
cat > "$STATE_FILE" <<EOF
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: true
  phase-10-done: true
  phase-11-done: true

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: bootstrap-terminate
---
EOF
RESP

  wf_run_fresh "build a thing" >/dev/null 2>&1 || true

  assert_file_exists "$STATE_FILE_PATH" "bootstrap: state.md created"
  assert_content_contains "$STATE_FILE_PATH" "schema-version: 1" "bootstrap: schema-version set"
}

# ======================================================================
# CASE 2 — Phase 1→2→4→5→6→7→9→10→11 (non-ui happy path)
# ======================================================================
case_happy_path_non_ui() {
  wf_init happy_non_ui

  # Dispatch 1: Phase 1 emits: review item + implement item
  wf_enqueue <<'RESP'
cat > "$STATE_FILE" <<EOF
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan
---
id: item-002
tag: to-review-plan
status: pending
emitted-by-phase: 1
artifact:
permissions:
parent: item-001
title: REVIEW: confirm
---
id: item-010
tag: to-implement
status: pending
emitted-by-phase: 1
artifact: .workflow/plan.md#step-1
permissions:
parent: item-001
title: Phase 4 step 1
---
EOF
RESP

  # Dispatch 2: Phase 2 closes review item (no HUMAN)
  wf_enqueue <<'RESP'
cat > "$STATE_FILE" <<EOF
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan
---
id: item-002
tag: to-review-plan
status: done
emitted-by-phase: 1
artifact: .workflow/plan.md#review-1
permissions:
parent: item-001
title: REVIEW: confirm
---
id: item-010
tag: to-implement
status: pending
emitted-by-phase: 1
artifact: .workflow/plan.md#step-1
permissions:
parent: item-001
title: Phase 4 step 1
---
EOF
RESP

  # Dispatch 3: Phase 4 closes implement + emits to-verify
  wf_enqueue <<'RESP'
cat > "$STATE_FILE" <<EOF
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan
---
id: item-002
tag: to-review-plan
status: done
emitted-by-phase: 1
artifact: .workflow/plan.md#review-1
permissions:
parent: item-001
title: REVIEW: confirm
---
id: item-010
tag: to-implement
status: done
emitted-by-phase: 1
artifact: .workflow/iter-1/status.md
permissions:
parent: item-001
title: Phase 4 step 1
---
id: item-020
tag: code-complete-needs-verification
status: pending
emitted-by-phase: 4
artifact: .workflow/iter-1/status.md
permissions:
parent: item-010
title: verify step 1
---
EOF
RESP

  # Dispatch 4: Phase 5 passes → emits to-code-review
  wf_enqueue <<'RESP'
cat > "$STATE_FILE" <<EOF
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan
---
id: item-002
tag: to-review-plan
status: done
emitted-by-phase: 1
artifact: .workflow/plan.md#review-1
permissions:
parent: item-001
title: REVIEW: confirm
---
id: item-010
tag: to-implement
status: done
emitted-by-phase: 1
artifact: .workflow/iter-1/status.md
permissions:
parent: item-001
title: Phase 4 step 1
---
id: item-020
tag: code-complete-needs-verification
status: done
emitted-by-phase: 4
artifact: .workflow/iter-1/validation-report.md
permissions:
parent: item-010
title: verify step 1
---
id: item-030
tag: to-code-review
status: pending
emitted-by-phase: 5
artifact: .workflow/iter-1/validation-report.md
permissions:
parent: item-020
title: review iter-1
---
EOF
RESP

  # Dispatch 5: Phase 6 closes review + emits to-triage
  wf_enqueue <<'RESP'
cat > "$STATE_FILE" <<EOF
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan
---
id: item-002
tag: to-review-plan
status: done
emitted-by-phase: 1
artifact: .workflow/plan.md#review-1
permissions:
parent: item-001
title: REVIEW: confirm
---
id: item-010
tag: to-implement
status: done
emitted-by-phase: 1
artifact: .workflow/iter-1/status.md
permissions:
parent: item-001
title: Phase 4 step 1
---
id: item-020
tag: code-complete-needs-verification
status: done
emitted-by-phase: 4
artifact: .workflow/iter-1/validation-report.md
permissions:
parent: item-010
title: verify step 1
---
id: item-030
tag: to-code-review
status: done
emitted-by-phase: 5
artifact: .workflow/iter-1/review/
permissions:
parent: item-020
title: review iter-1
---
id: item-040
tag: to-triage
status: pending
emitted-by-phase: 6
artifact: .workflow/iter-1/review/
permissions:
parent: item-030
title: triage iter-1 findings
---
EOF
RESP

  # Dispatch 6: Phase 7 all AUTO_SKIP → no new items
  wf_enqueue <<'RESP'
cat > "$STATE_FILE" <<EOF
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan
---
id: item-002
tag: to-review-plan
status: done
emitted-by-phase: 1
artifact: .workflow/plan.md#review-1
permissions:
parent: item-001
title: REVIEW: confirm
---
id: item-010
tag: to-implement
status: done
emitted-by-phase: 1
artifact: .workflow/iter-1/status.md
permissions:
parent: item-001
title: Phase 4 step 1
---
id: item-020
tag: code-complete-needs-verification
status: done
emitted-by-phase: 4
artifact: .workflow/iter-1/validation-report.md
permissions:
parent: item-010
title: verify step 1
---
id: item-030
tag: to-code-review
status: done
emitted-by-phase: 5
artifact: .workflow/iter-1/review/
permissions:
parent: item-020
title: review iter-1
---
id: item-040
tag: to-triage
status: done
emitted-by-phase: 6
artifact: .workflow/iter-1/triage.md
permissions:
parent: item-030
title: triage iter-1 findings
---
EOF
RESP

  # Dispatch 7: Phase 9 — no-op (orchestrator sets the flag)
  wf_enqueue <<'RESP'
# Phase 9: doc sweep — no item emissions. Orchestrator sets phase-9-done.
:
RESP
  # Dispatch 8: Phase 10
  wf_enqueue <<'RESP'
:
RESP
  # Dispatch 9: Phase 11
  wf_enqueue <<'RESP'
:
RESP

  wf_run_fresh "build a thing" >/dev/null 2>&1
  local rc=$?

  if [ "$rc" -eq 0 ]; then ok "happy non-ui: orchestrator exited 0"; else fail "happy non-ui: orchestrator exit code $rc"; fi

  local phases
  phases="$(wf_trace_phases)"
  if [ "$phases" = "1 2 4 5 6 7 9 10 11" ]; then
    ok "happy non-ui: dispatch sequence 1 2 4 5 6 7 9 10 11"
  else
    fail "happy non-ui: phases were '$phases'"
  fi

  local p11
  p11=$(wfs_meta phase-11-done "$STATE_FILE_PATH")
  if [ "$p11" = "true" ]; then ok "happy non-ui: phase-11-done set"; else fail "happy non-ui: phase-11-done='$p11'"; fi
}

# ======================================================================
# CASE 3 — Phase 2 HUMAN pauses; resume via --user-prompt continues
# ======================================================================
case_phase2_human_pause_and_resume() {
  wf_init phase2_human

  # Dispatch 1: Phase 1 emits 1 review + 1 implement
  wf_enqueue <<'RESP'
emit_state_phase1_done_non_ui_local() {
cat <<EOF
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan
---
id: item-002
tag: to-review-plan
status: pending
emitted-by-phase: 1
artifact:
permissions:
parent: item-001
title: REVIEW: confirm
---
id: item-010
tag: to-implement
status: pending
emitted-by-phase: 1
artifact: .workflow/plan.md#step-1
permissions:
parent: item-001
title: Phase 4 step 1
---
EOF
}
emit_state_phase1_done_non_ui_local > "$STATE_FILE"
RESP

  # Dispatch 2: Phase 2 leaves item-002 as HUMAN
  wf_enqueue <<'RESP'
cat > "$STATE_FILE" <<EOF
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan
---
id: item-002
tag: to-review-plan
status: HUMAN
emitted-by-phase: 1
artifact: .workflow/plan.md#review-1
permissions:
parent: item-001
title: REVIEW: confirm
---
id: item-010
tag: to-implement
status: pending
emitted-by-phase: 1
artifact: .workflow/plan.md#step-1
permissions:
parent: item-001
title: Phase 4 step 1
---
EOF
RESP

  # NOTE: best-effort-before-pause means after Phase 2 emits HUMAN,
  # item-010 (to-implement) is still pending → orchestrator should
  # dispatch Phase 4 before pausing. Dispatch 3: Phase 4 closes
  # item-010 cleanly with skip tags (terminate this run quickly).
  wf_enqueue <<'RESP'
cat > "$STATE_FILE" <<EOF
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan
---
id: item-002
tag: to-review-plan
status: HUMAN
emitted-by-phase: 1
artifact: .workflow/plan.md#review-1
permissions:
parent: item-001
title: REVIEW: confirm
---
id: item-010
tag: to-implement
status: done
emitted-by-phase: 1
artifact: .workflow/iter-1/status.md
permissions:
parent: item-001
title: Phase 4 step 1
---
id: item-020
tag: code-complete-needs-verification
status: pending
emitted-by-phase: 4
artifact: .workflow/iter-1/status.md
permissions:
parent: item-010
title: verify
---
EOF
RESP

  # Dispatch 4: Phase 5 closes verify, emits to-code-review
  wf_enqueue <<'RESP'
cat > "$STATE_FILE" <<EOF
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan
---
id: item-002
tag: to-review-plan
status: HUMAN
emitted-by-phase: 1
artifact: .workflow/plan.md#review-1
permissions:
parent: item-001
title: REVIEW: confirm
---
id: item-010
tag: to-implement
status: done
emitted-by-phase: 1
artifact: .workflow/iter-1/status.md
permissions:
parent: item-001
title: Phase 4 step 1
---
id: item-020
tag: code-complete-needs-verification
status: done
emitted-by-phase: 4
artifact: .workflow/iter-1/validation-report.md
permissions:
parent: item-010
title: verify
---
id: item-030
tag: to-code-review
status: pending
emitted-by-phase: 5
artifact: .workflow/iter-1/validation-report.md
permissions:
parent: item-020
title: review iter-1
---
EOF
RESP

  # Dispatch 5: Phase 6 closes review, emits to-triage
  wf_enqueue <<'RESP'
cat > "$STATE_FILE" <<EOF
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan
---
id: item-002
tag: to-review-plan
status: HUMAN
emitted-by-phase: 1
artifact: .workflow/plan.md#review-1
permissions:
parent: item-001
title: REVIEW: confirm
---
id: item-010
tag: to-implement
status: done
emitted-by-phase: 1
artifact: .workflow/iter-1/status.md
permissions:
parent: item-001
title: Phase 4 step 1
---
id: item-020
tag: code-complete-needs-verification
status: done
emitted-by-phase: 4
artifact: .workflow/iter-1/validation-report.md
permissions:
parent: item-010
title: verify
---
id: item-030
tag: to-code-review
status: done
emitted-by-phase: 5
artifact: .workflow/iter-1/review/
permissions:
parent: item-020
title: review iter-1
---
id: item-040
tag: to-triage
status: pending
emitted-by-phase: 6
artifact: .workflow/iter-1/review/
permissions:
parent: item-030
title: triage
---
EOF
RESP

  # Dispatch 6: Phase 7 all AUTO_SKIP — no new items → orchestrator
  # should now pause (no actionable + 1 HUMAN).
  wf_enqueue <<'RESP'
cat > "$STATE_FILE" <<EOF
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan
---
id: item-002
tag: to-review-plan
status: HUMAN
emitted-by-phase: 1
artifact: .workflow/plan.md#review-1
permissions:
parent: item-001
title: REVIEW: confirm
---
id: item-010
tag: to-implement
status: done
emitted-by-phase: 1
artifact: .workflow/iter-1/status.md
permissions:
parent: item-001
title: Phase 4 step 1
---
id: item-020
tag: code-complete-needs-verification
status: done
emitted-by-phase: 4
artifact: .workflow/iter-1/validation-report.md
permissions:
parent: item-010
title: verify
---
id: item-030
tag: to-code-review
status: done
emitted-by-phase: 5
artifact: .workflow/iter-1/review/
permissions:
parent: item-020
title: review iter-1
---
id: item-040
tag: to-triage
status: done
emitted-by-phase: 6
artifact: .workflow/iter-1/triage.md
permissions:
parent: item-030
title: triage
---
EOF
RESP

  wf_run_fresh "test request" >/dev/null 2>&1
  local rc=$?

  # On pause, orchestrator should exit with non-zero distinguishable
  # code (we'll use 10 — orchestrator's convention).
  if [ "$rc" -eq 10 ]; then
    ok "phase2 pause: exited with pause code 10"
  else
    fail "phase2 pause: expected exit code 10, got $rc"
  fi

  local phases
  phases="$(wf_trace_phases)"
  if [ "$phases" = "1 2 4 5 6 7" ]; then
    ok "phase2 pause: drained actionable items before pausing (best-effort)"
  else
    fail "phase2 pause: phases were '$phases' (expected 1 2 4 5 6 7)"
  fi

  # Now resume with --user-prompt. Orchestrator should re-dispatch
  # Phase 2 (the phase that emitted the HUMAN item).
  wf_enqueue <<'RESP'
# Phase 2 (resumed) — closes item-002 (HUMAN → done)
awk '
  /^id: item-002$/ { in_hit=1 }
  in_hit && /^status:/ { sub(/:.*$/, ": done"); in_hit=0 }
  { print }
' "$STATE_FILE" > "$STATE_FILE.tmp"
mv "$STATE_FILE.tmp" "$STATE_FILE"
RESP
  # Then Phase 9/10/11 sweep
  wf_enqueue <<'RESP'
:
RESP
  wf_enqueue <<'RESP'
:
RESP
  wf_enqueue <<'RESP'
:
RESP

  wf_run_resume "for point 002, use approach X" >/dev/null 2>&1
  rc=$?
  if [ "$rc" -eq 0 ]; then ok "phase2 resume: exited 0"; else fail "phase2 resume: exit code $rc"; fi

  local p11
  p11=$(wfs_meta phase-11-done "$STATE_FILE_PATH")
  if [ "$p11" = "true" ]; then ok "phase2 resume: phase-11-done set"; else fail "phase2 resume: phase-11-done='$p11'"; fi
}

# ======================================================================
# CASE 4 — Phase 7 mixed batch drains AUTO_APPLY items before pause
# ======================================================================
case_phase7_mixed_batch_drains() {
  wf_init phase7_mixed

  # Seed: state already past Phase 6, ready for Phase 7 dispatch.
  wf_seed_state <<'STATE'
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan
---
id: item-010
tag: to-implement
status: done
emitted-by-phase: 1
artifact: .workflow/iter-1/status.md
permissions:
parent: item-001
title: step 1
---
id: item-020
tag: code-complete-needs-verification
status: done
emitted-by-phase: 4
artifact: .workflow/iter-1/validation-report.md
permissions:
parent: item-010
title: verify
---
id: item-030
tag: to-code-review
status: done
emitted-by-phase: 5
artifact: .workflow/iter-1/review/
permissions:
parent: item-020
title: review
---
id: item-040
tag: to-triage
status: pending
emitted-by-phase: 6
artifact: .workflow/iter-1/review/
permissions:
parent: item-030
title: triage
---
STATE

  # Dispatch 1: Phase 7 — mixed batch: 1 AUTO_APPLY (skip-eligible) +
  # 1 ASK. The ASK has audit artifact.
  wf_enqueue <<'RESP'
cat > "$STATE_FILE" <<EOF
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan
---
id: item-010
tag: to-implement
status: done
emitted-by-phase: 1
artifact: .workflow/iter-1/status.md
permissions:
parent: item-001
title: step 1
---
id: item-020
tag: code-complete-needs-verification
status: done
emitted-by-phase: 4
artifact: .workflow/iter-1/validation-report.md
permissions:
parent: item-010
title: verify
---
id: item-030
tag: to-code-review
status: done
emitted-by-phase: 5
artifact: .workflow/iter-1/review/
permissions:
parent: item-020
title: review
---
id: item-040
tag: to-triage
status: done
emitted-by-phase: 6
artifact: .workflow/iter-1/triage.md
permissions:
parent: item-030
title: triage
---
id: item-050
tag: to-implement
status: pending
emitted-by-phase: 7
artifact: .workflow/iter-1/triage.md#finding-1
permissions: skip-eligible
parent: item-040
title: AUTO_APPLY finding 1
---
id: item-051
tag:
status: ASK
emitted-by-phase: 7
artifact: .workflow/iter-1/triage.md#finding-2
permissions:
parent: item-040
title: ASK finding 2
---
EOF
RESP

  # Dispatch 2: Phase 4 picks up item-050 (skip-eligible), declares
  # both skip tags → no Phase 5/6 dispatch follows.
  wf_enqueue <<'RESP'
cat > "$STATE_FILE" <<EOF
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan
---
id: item-010
tag: to-implement
status: done
emitted-by-phase: 1
artifact: .workflow/iter-1/status.md
permissions:
parent: item-001
title: step 1
---
id: item-020
tag: code-complete-needs-verification
status: done
emitted-by-phase: 4
artifact: .workflow/iter-1/validation-report.md
permissions:
parent: item-010
title: verify
---
id: item-030
tag: to-code-review
status: done
emitted-by-phase: 5
artifact: .workflow/iter-1/review/
permissions:
parent: item-020
title: review
---
id: item-040
tag: to-triage
status: done
emitted-by-phase: 6
artifact: .workflow/iter-1/triage.md
permissions:
parent: item-030
title: triage
---
id: item-050
tag: to-implement
status: done
emitted-by-phase: 7
artifact: .workflow/iter-2/status.md
permissions: skip-eligible
parent: item-040
title: AUTO_APPLY finding 1
skip: no-verification-needed,no-review-needed
---
id: item-051
tag:
status: ASK
emitted-by-phase: 7
artifact: .workflow/iter-1/triage.md#finding-2
permissions:
parent: item-040
title: ASK finding 2
---
EOF
RESP

  # No more dispatches expected — orchestrator should now pause on
  # item-051 (ASK).

  wf_run_resume >/dev/null 2>&1
  local rc=$?
  if [ "$rc" -eq 10 ]; then ok "phase7 mixed: paused with code 10"; else fail "phase7 mixed: rc=$rc"; fi

  local phases
  phases="$(wf_trace_phases)"
  if [ "$phases" = "7 4" ]; then
    ok "phase7 mixed: drained AUTO_APPLY (phase 4) before pausing"
  else
    fail "phase7 mixed: phases were '$phases' (expected '7 4')"
  fi

  # No iteration counter — Q-review-fix-D dissolved it in favor of
  # timestamped batch directories. The drain-before-pause assertion
  # above is what we actually care about.
}

# ======================================================================
# CASE 5 — Invariant 5.4 — skip-eligible from phase 1 is refused
# ======================================================================
case_invariant_skip_eligible_authority() {
  wf_init inv_skip_eligible

  # Seed a state with an illegal skip-eligible from phase 1
  wf_seed_state <<'STATE'
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan
---
id: item-010
tag: to-implement
status: pending
emitted-by-phase: 1
artifact: .workflow/plan.md#step-1
permissions: skip-eligible
parent: item-001
title: illegal skip-eligible from phase 1
---
STATE

  wf_run_resume >/dev/null 2>&1
  local rc=$?
  if [ "$rc" -ne 0 ] && [ "$rc" -ne 10 ]; then
    ok "skip-eligible authority: orchestrator refused (rc=$rc)"
  else
    fail "skip-eligible authority: orchestrator did not refuse (rc=$rc)"
  fi

  # No fixture should have been consumed
  if ! grep -q 'phase=' "$WORKFLOW_TRACE_FILE" 2>/dev/null; then
    ok "skip-eligible authority: no phase dispatched"
  else
    fail "skip-eligible authority: dispatched despite refusal"
  fi
}

# ======================================================================
# CASE 6 — Invariant 5.5 — skip tags without permission refused
# ======================================================================
case_invariant_skip_tag_authority() {
  wf_init inv_skip_tag

  wf_seed_state <<'STATE'
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan
---
id: item-010
tag: to-implement
status: done
emitted-by-phase: 1
artifact: .workflow/iter-1/status.md
permissions:
parent: item-001
title: declares skip without permission
skip: no-verification-needed
---
STATE

  wf_run_resume >/dev/null 2>&1
  local rc=$?
  if [ "$rc" -ne 0 ] && [ "$rc" -ne 10 ]; then
    ok "skip-tag authority: refused (rc=$rc)"
  else
    fail "skip-tag authority: not refused (rc=$rc)"
  fi
}

# ======================================================================
# CASE 7 — Invariant 5.8 — missing emitted-by-phase refused
# ======================================================================
case_invariant_source_phase_audit() {
  wf_init inv_source_phase

  wf_seed_state <<'STATE'
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: pending
emitted-by-phase:
artifact:
permissions:
parent:
title: missing source phase
---
STATE

  wf_run_resume >/dev/null 2>&1
  local rc=$?
  if [ "$rc" -ne 0 ] && [ "$rc" -ne 10 ]; then
    ok "source-phase audit: refused (rc=$rc)"
  else
    fail "source-phase audit: not refused (rc=$rc)"
  fi
}

# ======================================================================
# CASE 8 — Invariant 5.12 — unknown schema-version refused
# ======================================================================
case_invariant_schema_gate() {
  wf_init inv_schema

  wf_seed_state <<'STATE'
# workflow state

meta:
  schema-version: 99
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: pending
emitted-by-phase: 0
artifact:
permissions:
parent:
title: schema mismatch
---
STATE

  wf_run_resume >/dev/null 2>&1
  local rc=$?
  if [ "$rc" -ne 0 ] && [ "$rc" -ne 10 ]; then
    ok "schema gate: refused (rc=$rc)"
  else
    fail "schema gate: not refused (rc=$rc)"
  fi
}

# ======================================================================
# CASE 9 — Idempotent restart on terminal state is a no-op
# ======================================================================
case_idempotent_terminal() {
  wf_init idempotent_terminal

  wf_seed_state <<'STATE'
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: true
  phase-10-done: true
  phase-11-done: true

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: done
---
STATE

  wf_run_resume >/dev/null 2>&1
  local rc=$?
  if [ "$rc" -eq 0 ]; then ok "idempotent terminal: rc=0"; else fail "idempotent terminal: rc=$rc"; fi

  if ! grep -q 'phase=' "$WORKFLOW_TRACE_FILE" 2>/dev/null; then
    ok "idempotent terminal: no dispatch performed"
  else
    fail "idempotent terminal: dispatched at terminal"
  fi
}

# ======================================================================
# CASE 10 — Crash recovery: in-progress on entry reverts to pending
# ======================================================================
case_crash_recovery_in_progress() {
  wf_init crash_recovery

  wf_seed_state <<'STATE'
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan
---
id: item-010
tag: to-implement
status: in-progress
emitted-by-phase: 1
artifact: .workflow/plan.md#step-1
permissions:
parent: item-001
title: stale in-progress
---
STATE

  # Dispatch 1: Phase 4 closes it cleanly (terminal-friendly)
  wf_enqueue <<'RESP'
cat > "$STATE_FILE" <<EOF
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: true
  phase-10-done: true
  phase-11-done: true

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan
---
id: item-010
tag: to-implement
status: done
emitted-by-phase: 1
artifact: .workflow/iter-1/status.md
permissions:
parent: item-001
title: stale in-progress
---
EOF
RESP

  wf_run_resume >/dev/null 2>&1
  local rc=$?
  if [ "$rc" -eq 0 ]; then ok "crash recovery: rc=0"; else fail "crash recovery: rc=$rc"; fi

  local phases
  phases="$(wf_trace_phases)"
  if [ "$phases" = "4" ]; then
    ok "crash recovery: in-progress reverted to pending and dispatched to phase 4"
  else
    fail "crash recovery: phases='$phases' (expected '4')"
  fi
}

# ======================================================================
# CASE 11 — Lock prevents concurrent invocation
# ======================================================================
case_concurrent_lock() {
  wf_init concurrent_lock

  # Pre-create a lock DIRECTORY (mkdir is atomic, Q-review-fix-G) with
  # a live PID (current shell PID) inside it.
  mkdir -p "$TEST_WORK/.workflow/.lock"
  printf '%s\n' "$$" > "$TEST_WORK/.workflow/.lock/pid"

  wf_seed_state <<'STATE'
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: pending
emitted-by-phase: 0
artifact:
permissions:
parent:
title: would dispatch if no lock
---
STATE

  wf_run_resume >/dev/null 2>&1
  local rc=$?
  if [ "$rc" = "4" ]; then
    ok "concurrent lock: refused (rc=$rc)"
  else
    fail "concurrent lock: expected rc=4, got rc=$rc"
  fi

  if ! grep -q 'phase=' "$WORKFLOW_TRACE_FILE" 2>/dev/null; then
    ok "concurrent lock: no dispatch"
  else
    fail "concurrent lock: dispatched despite lock"
  fi

  # Cleanup so trap doesn't leak the live PID file
  rm -rf "$TEST_WORK/.workflow/.lock"
}

# ======================================================================
# CASE 12 — Pause without user-prompt is a no-op (no dispatch)
# ======================================================================
case_paused_without_prompt_is_noop() {
  wf_init paused_noop

  wf_seed_state <<'STATE'
# workflow state

meta:
  schema-version: 1
  ui_work: false
  phase-9-done: false
  phase-10-done: false
  phase-11-done: false

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: Plan
---
id: item-002
tag:
status: ASK
emitted-by-phase: 1
artifact: .workflow/plan.md#ask-1
permissions:
parent: item-001
title: pending question
---
STATE

  wf_run_resume >/dev/null 2>&1
  local rc=$?
  if [ "$rc" -eq 10 ]; then ok "paused no-op: rc=10 (pause)"; else fail "paused no-op: rc=$rc"; fi

  if ! grep -q 'phase=' "$WORKFLOW_TRACE_FILE" 2>/dev/null; then
    ok "paused no-op: no dispatch without prompt"
  else
    fail "paused no-op: dispatched without prompt"
  fi
}

# ======================================================================
# Run all cases
# ======================================================================
case_bootstrap
case_happy_path_non_ui
case_phase2_human_pause_and_resume
case_phase7_mixed_batch_drains
case_invariant_skip_eligible_authority
case_invariant_skip_tag_authority
case_invariant_source_phase_audit
case_invariant_schema_gate
case_idempotent_terminal
case_crash_recovery_in_progress
case_concurrent_lock
case_paused_without_prompt_is_noop
