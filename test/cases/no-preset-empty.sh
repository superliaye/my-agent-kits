#!/usr/bin/env bash
# --no-preset with no --capabilities yields an empty base: init runs headlessly
# (no prompt/hang) and deploys nothing. Verify it exits 0 and ~/.claude/skills
# is empty or absent.

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

if "$KIT_ROOT/bin/agent-kit" init --no-preset --agents claude; then
  ok "init --no-preset --agents claude exits 0"
else
  fail "init --no-preset --agents claude exited non-zero"
fi

assert_dir_empty_or_absent "$HOME/.claude/skills" "empty base: no skills deployed"
