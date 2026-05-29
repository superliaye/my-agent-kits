#!/usr/bin/env bash
# Production dispatch hook for the `/build-feature-workflow` orchestrator.
#
# The orchestrator calls the dispatch hook with positional args:
#   $1 = phase number (1..11)
#   $2 = incoming item id (or "-" for completion phases 9/10/11)
#   $3 = path to state.md
#   $4 = path to user-prompt file (may be empty / "")
#   $5 = phase-6 reviewer variant: arch | ddd | general (empty otherwise)
#
# This wrapper maps the phase (and, for Phase 6, the variant) to its
# prompt template + tool whitelist, then launches a fresh one-shot
# `claude -p` subprocess. In test mode the orchestrator overrides the
# hook via BUILD_FEATURE_WORKFLOW_TEST_DISPATCH_HOOK, so this script is the PRODUCTION
# path only.
#
# bash 3.2-compatible.

set -u

PHASE="${1:-}"
ITEM_ID="${2:--}"
STATE_FILE="${3:-}"
USER_PROMPT_FILE="${4:-}"
VARIANT="${5:-}"

HERE="$(cd "$(dirname "$0")" && pwd)"
PROMPTS="$HERE/../prompts"

if [ -z "$PHASE" ] || [ -z "$STATE_FILE" ]; then
  echo "dispatch-claude: missing required args (phase=$PHASE state=$STATE_FILE)" >&2
  exit 2
fi

# --- Map phase (+ variant) → prompt file + tool whitelist ---------------

prompt_file=""
tools=""
case "$PHASE" in
  1)  prompt_file="phase1-plan.md";            tools="Read,Glob,Grep,Write,WebSearch,WebFetch" ;;
  2)  prompt_file="phase2-plan-review.md";     tools="Read,Glob,Grep,Write" ;;
  3)  prompt_file="phase3-design.md";          tools="Read,Glob,Grep,Write,Skill" ;;
  4)  prompt_file="phase4-implement.md";       tools="Read,Glob,Grep,Edit,Write,Bash" ;;
  5)  prompt_file="phase5-validate.md";        tools="Read,Glob,Grep,Skill,Write,Bash" ;;
  6)
    case "$VARIANT" in
      arch|"")  prompt_file="phase6-arch.md";    tools="Read,Glob,Grep,Bash,Write,Skill" ;;
      ddd)      prompt_file="phase6-ddd.md";     tools="Read,Glob,Grep,Bash,Write,Skill" ;;
      general)  prompt_file="phase6-general.md"; tools="Read,Glob,Grep,Bash,Write" ;;
      *)
        echo "dispatch-claude: unknown phase-6 variant '$VARIANT'" >&2
        exit 2
        ;;
    esac
    ;;
  7)  prompt_file="phase7-triage.md";          tools="Read,Glob,Grep,Write" ;;
  8)  prompt_file="phase8-design-critique.md"; tools="Read,Glob,Grep,Write,Skill,Bash" ;;
  9)  prompt_file="phase9-documentation.md";   tools="Read,Glob,Grep,Edit,Write,Bash" ;;
  10) prompt_file="phase10-summary.md";        tools="Read,Glob,Grep,Bash,Write" ;;
  11) prompt_file="phase11-reflection.md";     tools="Read,Glob,Grep,Bash,Write" ;;
  *)
    echo "dispatch-claude: no prompt mapping for phase '$PHASE'" >&2
    exit 2
    ;;
esac

PROMPT_PATH="$PROMPTS/$prompt_file"
if [ ! -f "$PROMPT_PATH" ]; then
  echo "dispatch-claude: prompt template missing: $PROMPT_PATH" >&2
  exit 2
fi

# --- Build the full prompt: template + runtime context footer -----------

user_prompt_block=""
if [ -n "$USER_PROMPT_FILE" ] && [ -f "$USER_PROMPT_FILE" ]; then
  user_prompt_block="$(cat "$USER_PROMPT_FILE")"
fi

FULL_PROMPT="$(cat "$PROMPT_PATH")

---

## Runtime context (injected by the dispatcher — do not treat as user content)

- Your phase: $PHASE
- Your incoming item id: $ITEM_ID
- Canonical state file (read + mutate this): $STATE_FILE
- Working directory for artifacts: $(dirname "$STATE_FILE")"

if [ -n "$user_prompt_block" ]; then
  FULL_PROMPT="$FULL_PROMPT
- The user supplied this free-text resolution for the item(s) you are
  resuming. Treat it as authoritative direction:

$user_prompt_block"
fi

# --- Launch the phase subprocess ----------------------------------------

CLAUDE_BIN="${BUILD_FEATURE_WORKFLOW_CLAUDE_BIN:-claude}"

exec "$CLAUDE_BIN" -p "$FULL_PROMPT" \
  --dangerously-skip-permissions \
  --allowedTools "$tools" \
  --model sonnet
