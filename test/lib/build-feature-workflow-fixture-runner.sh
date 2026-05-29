#!/usr/bin/env bash
# Test-side dispatcher hook. The orchestrator calls this as if it were
# `claude -p ...` — but instead of invoking the real LLM, this script
# picks up the next pre-recorded fixture response and applies it.
#
# Required env:
#   BUILD_FEATURE_WORKFLOW_FIXTURE_DIR   directory containing NNN.sh response scripts +
#                          a `.counter` file tracking dispatch index
#   BUILD_FEATURE_WORKFLOW_TRACE_FILE    line-buffered log of dispatches (for assertions)
#
# Args (the orchestrator's dispatch contract):
#   $1 = phase number (1..11)
#   $2 = item id (or "-" for completion phases)
#   $3 = path to state file
#   $4 = path to user-prompt file (may be empty / unset)
#
# Each response script is sourced (not exec'd) under bash, so it has
# access to:
#   PHASE          dispatch phase
#   ITEM_ID        incoming item ID
#   STATE_FILE     state file path to mutate
#   USER_PROMPT_FILE  user prompt path (may be empty)
#   FIXTURE_INDEX  1-indexed dispatch count

set -u

PHASE="${1:-}"
ITEM_ID="${2:--}"
STATE_FILE="${3:-}"
USER_PROMPT_FILE="${4:-}"
VARIANT="${5:-}"

if [ -z "$PHASE" ] || [ -z "$STATE_FILE" ]; then
  echo "fixture-runner: missing required args (phase=$PHASE state=$STATE_FILE)" >&2
  exit 2
fi
if [ -z "${BUILD_FEATURE_WORKFLOW_FIXTURE_DIR:-}" ] || [ -z "${BUILD_FEATURE_WORKFLOW_TRACE_FILE:-}" ]; then
  echo "fixture-runner: BUILD_FEATURE_WORKFLOW_FIXTURE_DIR or BUILD_FEATURE_WORKFLOW_TRACE_FILE not set" >&2
  exit 2
fi

# Phase 6 fan-out: orchestrator spawns three parallel reviewer sub-agents
# (arch / ddd / general). In test mode we collapse to a single logical
# dispatch: only the 'arch' variant runs the canonical fixture and gets
# a trace entry. The other two variants are no-ops (they represent
# parallel reviewers in production but don't matter for state-machine
# tests).
if [ "$PHASE" = "6" ] && [ -n "$VARIANT" ] && [ "$VARIANT" != "arch" ]; then
  exit 0
fi

COUNTER_FILE="$BUILD_FEATURE_WORKFLOW_FIXTURE_DIR/.counter"
N=$(cat "$COUNTER_FILE" 2>/dev/null || echo 0)
N=$((N + 1))
printf '%s\n' "$N" > "$COUNTER_FILE"
FIXTURE_INDEX="$N"

# Trace the dispatch BEFORE running the response, so a crashing fixture
# still leaves a trail.
printf '%d phase=%s item=%s\n' "$N" "$PHASE" "$ITEM_ID" >> "$BUILD_FEATURE_WORKFLOW_TRACE_FILE"

RESPONSE="$BUILD_FEATURE_WORKFLOW_FIXTURE_DIR/$(printf '%03d' "$N").sh"
if [ ! -f "$RESPONSE" ]; then
  echo "fixture-runner: no response for dispatch $N (phase=$PHASE item=$ITEM_ID)" >&2
  echo "fixture-runner: expected $RESPONSE" >&2
  exit 3
fi

export PHASE ITEM_ID STATE_FILE USER_PROMPT_FILE FIXTURE_INDEX
# shellcheck disable=SC1090
. "$RESPONSE"
