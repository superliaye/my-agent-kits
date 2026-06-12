#!/usr/bin/env bash
# `init` is the only place the selection changes. Re-running it with a narrower
# selection must reconcile deletions: a skill in the prior manifest but absent
# from the new selection gets its deployed dir removed (agent-kit owns it).
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

export AGENT_KIT_SKIP_PLUGIN_INSTALL=1 AGENT_KIT_SKIP_BUNDLE_INSTALL=1

# First init: loop-full-swe preset deploys the loop-full-swe skill.
"$KIT_ROOT/bin/agent-kit" init --preset loop-full-swe --agents codex \
  || { fail "first init exited non-zero"; exit 1; }
assert_dir_exists "$HOME/.agents/skills/loop-full-swe" "loop-full-swe deployed by first init"

# Second init: engineering preset does NOT include loop-full-swe.
"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents codex \
  || { fail "second init exited non-zero"; exit 1; }

# Dropped skill reconciled away.
if [ -d "$HOME/.agents/skills/loop-full-swe" ]; then
  fail "re-init with narrower selection must remove the dropped skill"
else
  ok "init reconciled the dropped skill (loop-full-swe removed)"
fi
# Newly-selected skill present.
assert_file_exists "$HOME/.agents/skills/my-commit/SKILL.md" "engineering skill deployed by second init"
# Manifest reflects the new, narrower selection.
if grep -q "loop-full-swe" "$HOME/.agent-kit/manifest.json"; then
  fail "manifest must drop the deselected skill"
else
  ok "manifest reflects the narrowed selection"
fi
