#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

# Isolate BOTH HOME and USERPROFILE so the global writes land in a throwaway dir.
TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

"$KIT_ROOT/bin/agent-kit" init --preset productivity --agents claude \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# teach skill folder + the format docs its SKILL.md links to must deploy together
assert_file_exists "$HOME/.claude/skills/teach/SKILL.md" "teach skill deployed"
assert_file_exists "$HOME/.claude/skills/teach/MISSION-FORMAT.md" "teach companion (MISSION-FORMAT.md) deployed"
assert_file_exists "$HOME/.claude/skills/teach/GLOSSARY-FORMAT.md" "teach companion (GLOSSARY-FORMAT.md) deployed"
assert_content_contains "$HOME/.claude/skills/teach/SKILL.md" "teaching workspace" "teach SKILL body present"
