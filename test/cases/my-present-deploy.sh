#!/usr/bin/env bash
# Deploy smoke test for my-present via the productivity preset.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

# Isolate BOTH HOME and USERPROFILE so global writes land in a throwaway dir.
TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"; git init -q .

export AGENT_KIT_SKIP_BUNDLE_INSTALL=1

"$KIT_ROOT/bin/agent-kit" init --preset productivity --agents claude \
  || { fail "agent-kit init exited non-zero"; exit 1; }

skill="$HOME/.claude/skills/my-present/SKILL.md"
assert_file_exists "$skill" "my-present SKILL.md deployed"
assert_content_contains "$skill" "Earn every bit of attention" "skill body present"
