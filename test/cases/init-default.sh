#!/usr/bin/env bash
# `init --default` takes every wizard default with no prompts: the pre-checked
# preset set and the preset's agents. Verifies it resolves fully (never blocks
# on a prompt) and lands the default global artifacts.
#
# AGENT_KIT_SKIP_PLUGIN_INSTALL=1 prevents touching the live Claude Code plugin set.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

# Isolate BOTH HOME and USERPROFILE so the global writes land in a throwaway dir.
TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

# No --preset/--agents: --default alone must fully resolve the run.
# `< /dev/null` asserts it never blocks waiting on a prompt.
AGENT_KIT_SKIP_PLUGIN_INSTALL=1 "$KIT_ROOT/bin/agent-kit" init --default < /dev/null \
  || { fail "agent-kit init --default exited non-zero"; exit 1; }

# Global-only: artifacts land where Claude Code reads them.
assert_file_exists "$HOME/.claude/CLAUDE.md" "global CLAUDE.md written by --default"
assert_content_contains "$HOME/.claude/CLAUDE.md" "Core Instructions" "core instruction present"
assert_dir_nonempty "$HOME/.claude/skills" "global skills deployed"
# the `loop` preset is in the default pre-checked set, so its loop-build skill lands.
assert_file_exists "$HOME/.claude/skills/loop-build/SKILL.md" "default preset set deployed (loop)"
