#!/usr/bin/env bash
# `/build-feature-workflow` orchestrator — the dispatch loop.
#
# Reads `<workdir>/state.md` (canonical tagged work-item queue), picks the
# next dispatchable item per the selection rule in
# `docs/design/build-feature-workflow-state-machine.md` §2.1, and invokes a phase agent
# via `${BUILD_FEATURE_WORKFLOW_TEST_DISPATCH_HOOK:-claude}`. Re-reads state after each
# dispatch, validates, continues until no actionable items remain. Then
# runs the Phase 9 → 10 → 11 terminal sweep. Exits to pause when only
# escalated items (ASK/HUMAN/DECISION) remain.
#
# Exit codes:
#   0  complete (or no-op on terminal state)
#   2  invalid arguments
#   3  state file refused (validation failed; state untouched)
#   4  another invocation holds the lock
#   5  dispatch hook missing / phase agent failed
#  10  paused (escalations present, no actionable work)
#
# This script is bash 3.2-compatible (macOS default + Git Bash).

set -u

HERE="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
. "$HERE/lib/state-ops.sh"

# --- Argument parsing ----------------------------------------------------

WORKDIR=""
USER_REQUEST=""
USER_PROMPT=""
USER_PROMPT_PROVIDED=0

while [ $# -gt 0 ]; do
  case "$1" in
    --workdir)
      WORKDIR="${2:-}"; shift 2 ;;
    --user-request)
      USER_REQUEST="${2:-}"; shift 2 ;;
    --user-prompt)
      USER_PROMPT="${2:-}"; USER_PROMPT_PROVIDED=1; shift 2 ;;
    --help|-h)
      cat <<USAGE
usage: orchestrator.sh --workdir <path> [--user-request "<text>"] [--user-prompt "<text>"]

  --workdir       Path to .build-feature-workflow/ directory (required)
  --user-request  Initial feature request (bootstrap only, when no state)
  --user-prompt   Free-text resolution for paused escalations
USAGE
      exit 0
      ;;
    *)
      echo "orchestrator: unknown arg: $1" >&2
      exit 2
      ;;
  esac
done

if [ -z "$WORKDIR" ]; then
  echo "orchestrator: --workdir is required" >&2
  exit 2
fi

mkdir -p "$WORKDIR"
STATE_FILE="$WORKDIR/state.md"
LOCK_DIR="$WORKDIR/.lock"

# --- Lock (atomic mkdir, TOCTOU-safe) -----------------------------------

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  held_pid="$(cat "$LOCK_DIR/pid" 2>/dev/null || echo '')"
  if [ -n "$held_pid" ] && kill -0 "$held_pid" 2>/dev/null; then
    echo "orchestrator: lock held by pid $held_pid at $LOCK_DIR" >&2
    exit 4
  fi
  # Stale lock: tear down + re-acquire atomically.
  rm -rf "$LOCK_DIR"
  if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    echo "orchestrator: lock race detected; another invocation acquired" >&2
    exit 4
  fi
fi
printf '%s\n' "$$" > "$LOCK_DIR/pid"
trap 'rm -rf "$LOCK_DIR"' EXIT

# --- Bootstrap -----------------------------------------------------------

if [ ! -f "$STATE_FILE" ]; then
  if [ -z "$USER_REQUEST" ]; then
    echo "orchestrator: no state file at $STATE_FILE — provide --user-request to bootstrap" >&2
    exit 2
  fi
  title_safe="$(printf '%s' "$USER_REQUEST" | tr '\n\r' '  ' | cut -c1-120)"
  cat > "$STATE_FILE" <<EOF
# build-feature-workflow state

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
title: Plan for: $title_safe
---
EOF
fi

# --- Validate on entry ---------------------------------------------------

if ! wfs_validate "$STATE_FILE"; then
  exit 3
fi

# --- Crash recovery (invariant 5.11) -------------------------------------

if grep -q '^status: in-progress$' "$STATE_FILE" 2>/dev/null; then
  awk '
    /^status: in-progress$/ { print "status: pending"; next }
    { print }
  ' "$STATE_FILE" > "$STATE_FILE.tmp"
  mv "$STATE_FILE.tmp" "$STATE_FILE"
fi

# --- Helpers -------------------------------------------------------------

# Production dispatch goes through lib/dispatch-claude.sh, which maps
# phase + variant → prompt template + tool whitelist and launches a
# one-shot `claude -p`. Tests override this via BUILD_FEATURE_WORKFLOW_TEST_DISPATCH_HOOK.
HOOK="${BUILD_FEATURE_WORKFLOW_TEST_DISPATCH_HOOK:-$HERE/lib/dispatch-claude.sh}"

# pick_next prints "<id> <tag> <emitted-by-phase>" of the next dispatchable
# item, or empty if none. Selection rule §2.1:
#   1. lowest tag-priority (tag-priority enforces "one phase at a time")
#   2. then lowest emitted-by-phase
#   3. then lowest numeric ID
pick_next() {
  wfs_dispatchable_items "$STATE_FILE" \
    | awk '
        function tag_prio(t) {
          if (t == "to-plan")                          return 0
          if (t == "to-review-plan")                   return 1
          if (t == "to-design")                        return 2
          if (t == "to-implement")                     return 3
          if (t == "code-complete-needs-verification") return 4
          if (t == "to-code-review")                   return 5
          if (t == "to-triage")                        return 6
          if (t == "to-design-critique")               return 7
          return 99
        }
        {
          id = $1; sub(/^item-0*/, "", id)
          printf "%d\t%s\t%s\t%s\n", tag_prio($2), $3, id, $0
        }
      ' \
    | sort -k1,1n -k2,2n -k3,3n \
    | head -1 \
    | cut -f4-
}

count_dispatchable() {
  wfs_dispatchable_items "$STATE_FILE" | grep -c . || true
}

count_escalated() {
  wfs_escalated_items "$STATE_FILE" | grep -c . || true
}

# Set a meta field by rewriting the meta block. Bash 3.2 + awk.
set_meta() {
  local key="$1" val="$2"
  awk -v K="$key" -v V="$val" '
    BEGIN { in_meta=0; printed=0 }
    /^meta:/ { in_meta=1; print; next }
    in_meta && /^[^ ]/ {
      # End of meta block: ensure key was emitted.
      if (!printed) { print "  " K ": " V; printed=1 }
      in_meta=0
    }
    in_meta {
      line=$0
      sub(/^[ \t]+/, "", line)
      idx=index(line, ":")
      if (idx > 0) {
        k=substr(line, 1, idx-1)
        if (k == K) { print "  " K ": " V; printed=1; next }
      }
      print
      next
    }
    { print }
    END {
      if (in_meta && !printed) print "  " K ": " V
    }
  ' "$STATE_FILE" > "$STATE_FILE.tmp"
  mv "$STATE_FILE.tmp" "$STATE_FILE"
}

# dispatch <phase> <item_id>
# Phase 6 fans out three parallel reviewer sub-agents (arch / ddd / general)
# per Q-phase6 lock; all other phases invoke a single hook call.
dispatch() {
  local phase="$1"
  local item_id="$2"
  local prompt_file=""
  if [ "$USER_PROMPT_PROVIDED" = "1" ]; then
    prompt_file="$WORKDIR/.user-prompt"
    printf '%s' "$USER_PROMPT" > "$prompt_file"
    # Log the resolution for Phase 11 reflection (Q-resolution-via-prompt).
    # One line per invocation: ISO-8601 timestamp, receiving phase, text.
    printf '%s\tphase=%s\t%s\n' \
      "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$phase" \
      "$(printf '%s' "$USER_PROMPT" | tr '\n\r\t' '   ')" \
      >> "$WORKDIR/user-overrides.log"
    # consume — embed only into the next dispatch
    USER_PROMPT=""
    USER_PROMPT_PROVIDED=0
  fi

  if [ "$phase" -eq 6 ]; then
    local rc_arch=0 rc_ddd=0 rc_general=0
    "$HOOK" 6 "$item_id" "$STATE_FILE" "$prompt_file" arch &
    local pid_arch=$!
    "$HOOK" 6 "$item_id" "$STATE_FILE" "$prompt_file" ddd &
    local pid_ddd=$!
    "$HOOK" 6 "$item_id" "$STATE_FILE" "$prompt_file" general &
    local pid_general=$!
    wait "$pid_arch"    || rc_arch=$?
    wait "$pid_ddd"     || rc_ddd=$?
    wait "$pid_general" || rc_general=$?
    if [ "$rc_arch" -ne 0 ] || [ "$rc_ddd" -ne 0 ] || [ "$rc_general" -ne 0 ]; then
      echo "orchestrator: phase 6 fan-out failed (arch=$rc_arch ddd=$rc_ddd general=$rc_general)" >&2
      exit 5
    fi
  else
    "$HOOK" "$phase" "$item_id" "$STATE_FILE" "$prompt_file"
    local rc=$?
    if [ "$rc" -ne 0 ]; then
      echo "orchestrator: dispatch (phase=$phase item=$item_id) failed (rc=$rc)" >&2
      exit 5
    fi
  fi

  if ! wfs_validate "$STATE_FILE"; then
    echo "orchestrator: state invalid after dispatch (phase=$phase item=$item_id)" >&2
    exit 3
  fi
}

# --- Main loop -----------------------------------------------------------

MAX_TICKS=512
tick=0
while [ "$tick" -lt "$MAX_TICKS" ]; do
  tick=$((tick + 1))

  next="$(pick_next)"
  if [ -n "$next" ]; then
    item_id="$(printf '%s' "$next" | awk '{print $1}')"
    tag="$(printf '%s' "$next" | awk '{print $2}')"
    phase="$(wfs_phase_for_tag "$tag")"
    if [ "$phase" -eq 0 ]; then
      echo "orchestrator: cannot map tag '$tag' to a phase" >&2
      exit 3
    fi

    dispatch "$phase" "$item_id"
    continue
  fi

  # No actionable items. Check escalations.
  esc_count="$(count_escalated)"
  esc_count="${esc_count:-0}"
  if [ "$esc_count" -gt 0 ]; then
    if [ "$USER_PROMPT_PROVIDED" = "1" ]; then
      # Resume universally to emitted-by-phase. The phase that emitted
      # the escalation is the phase that consumes the user's resolution.
      # No hardcoded HUMAN→2 / DECISION→4 mapping (Q-review-fix-C).
      esc_line="$(wfs_escalated_items "$STATE_FILE" | head -1)"
      esc_id="$(printf '%s' "$esc_line" | awk '{print $1}')"
      esc_phase="$(wfs_item_field "$esc_id" emitted-by-phase "$STATE_FILE")"
      if [ -z "$esc_phase" ] || [ "$esc_phase" -lt 1 ] || [ "$esc_phase" -gt 11 ]; then
        echo "orchestrator: cannot determine resume phase for $esc_id (emitted-by-phase=$esc_phase)" >&2
        exit 3
      fi
      dispatch "$esc_phase" "$esc_id"
      continue
    fi
    exit 10
  fi

  # No actionable + no escalations: terminal sweep.
  phase9_done="$(wfs_meta phase-9-done "$STATE_FILE")"
  phase10_done="$(wfs_meta phase-10-done "$STATE_FILE")"
  phase11_done="$(wfs_meta phase-11-done "$STATE_FILE")"

  if [ "$phase9_done" != "true" ]; then
    dispatch 9 "-"
    set_meta phase-9-done true
    continue
  fi
  if [ "$phase10_done" != "true" ]; then
    dispatch 10 "-"
    set_meta phase-10-done true
    continue
  fi
  if [ "$phase11_done" != "true" ]; then
    dispatch 11 "-"
    set_meta phase-11-done true
    continue
  fi

  # Terminal.
  exit 0
done

echo "orchestrator: exceeded MAX_TICKS=$MAX_TICKS — bailing to prevent runaway" >&2
exit 5
