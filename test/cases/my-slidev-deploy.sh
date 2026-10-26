#!/usr/bin/env bash
# Deploy smoke test for my-slidev and my-slidev-agent via the productivity preset.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

# Isolate BOTH HOME and USERPROFILE so global writes land in a throwaway dir.
TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"; git init -q .

"$KIT_ROOT/bin/agent-kit" init --preset productivity --agents claude \
  || { fail "agent-kit init exited non-zero"; exit 1; }

assert_file_exists "$HOME/.claude/skills/my-slidev/SKILL.md" "my-slidev skill deployed globally"
assert_file_exists "$HOME/.claude/agents/my-slidev-agent.md" "my-slidev-agent deployed globally"
