#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

"$KIT_ROOT/bin/agent-kit" init --preset productivity --agents claude --scope repo \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# teach skill folder + the format docs its SKILL.md links to must deploy together
assert_file_exists "$WORK/.claude/skills/teach/SKILL.md" "teach skill deployed"
assert_file_exists "$WORK/.claude/skills/teach/MISSION-FORMAT.md" "teach companion (MISSION-FORMAT.md) deployed"
assert_file_exists "$WORK/.claude/skills/teach/GLOSSARY-FORMAT.md" "teach companion (GLOSSARY-FORMAT.md) deployed"
assert_content_contains "$WORK/.claude/skills/teach/SKILL.md" "teaching workspace" "teach SKILL body present"
