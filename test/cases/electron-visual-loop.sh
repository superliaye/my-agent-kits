#!/usr/bin/env bash
# Opt-in capability: electron-visual-loop is NOT in any preset by default.
# Verify it deploys when added on top of an empty base at init time, via a
# single headless invocation: `init --no-preset --agents claude
# --capabilities '+electron-visual-loop'`.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

# Isolate BOTH HOME and USERPROFILE so the global writes land in a throwaway dir.
TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
cleanup() {
  rm -rf "$WORK" "$TMPHOME"
}
trap cleanup EXIT

cd "$WORK"
git init -q .

"$KIT_ROOT/bin/agent-kit" init --no-preset --agents claude --capabilities '+electron-visual-loop' \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Positive: skill folder and SKILL.md land globally
assert_dir_nonempty "$HOME/.claude/skills/electron-visual-loop" "electron-visual-loop folder deployed"
assert_file_exists "$HOME/.claude/skills/electron-visual-loop/SKILL.md" "electron-visual-loop SKILL.md deployed"
assert_content_contains "$HOME/.claude/skills/electron-visual-loop/SKILL.md" "agent-browser" "skill body mentions agent-browser CLI"
assert_content_contains "$HOME/.claude/skills/electron-visual-loop/SKILL.md" "remote-debugging-port" "skill body documents CDP flag"
