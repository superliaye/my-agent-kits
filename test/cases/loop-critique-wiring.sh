#!/usr/bin/env bash
# Assert the critique wiring shipped into the deployed loop capabilities:
# loop-build-agent's AGENT.md runs /critique-committee only on a UI build and before
# the review committee (so the committee sees critique-driven changes), composed by
# invocable name; and the loop-build FLOW.md has a critique node. Structural greps,
# suite-enforced (AGENTS.md "Verify by deploying").
#
# AGENT_KIT_SKIP_PLUGIN_INSTALL=1 prevents touching the live Claude Code plugin set.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

AGENT_KIT_SKIP_PLUGIN_INSTALL=1 "$KIT_ROOT/bin/agent-kit" init \
  --preset loop --agents claude \
  || { fail "agent-kit init --preset loop exited non-zero"; exit 1; }

AGENT="$HOME/.claude/agents/loop-build-agent.md"
FLOW="$HOME/.claude/skills/loop-build/FLOW.md"
assert_file_exists "$AGENT" "loop-build-agent AGENT deployed"
assert_file_exists "$FLOW" "loop-build FLOW.md deployed"

# (a) The build agent names /critique-committee.
assert_content_contains "$AGENT" "/critique-committee" "AGENT names /critique-committee"

# (b) Critique runs only on a UI build (when there's a UI worth critiquing).
assert_content_contains "$AGENT" "UI worth critiquing" "critique runs only on a UI build"

# (c) Ordering: critique is named before review, so the committee sees its changes.
crit_line=$(grep -n "/critique-committee" "$AGENT" | head -1 | cut -d: -f1)
rev_line=$(grep -n "/loop-review-committee" "$AGENT" | head -1 | cut -d: -f1)
if [ -n "$crit_line" ] && [ -n "$rev_line" ] && [ "$crit_line" -lt "$rev_line" ]; then
  ok "critique ($crit_line) precedes review ($rev_line)"
else
  fail "critique not before review (critique=$crit_line review=$rev_line)"
fi

# FLOW.md names the critics and has a critique node.
assert_content_contains "$FLOW" "/critique-committee" "FLOW.md names /critique-committee"
assert_content_contains "$FLOW" "Critique[" "FLOW.md graph has a Critique node"

# Composition is by invocable name only — no repo-relative path to the critic agents.
if grep -qE 'capabilities/agents/@reviews|\.\./.*critic' "$AGENT" "$FLOW"; then
  fail "repo-relative path to a critic capability leaked into a deployed file"
else
  ok "critics referenced by invocable name only (no repo path)"
fi
