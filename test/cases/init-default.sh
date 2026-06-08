#!/usr/bin/env bash
# `init --default` takes every wizard default with no prompts: the pre-checked
# preset set, the preset's agents, global scope. Verifies it resolves fully
# (never blocks on a prompt) and lands the default artifacts, and that an
# explicit flag still overrides the matching default.
#
# AGENT_KIT_SKIP_PLUGIN_INSTALL=1 prevents touching the live Claude Code plugin set.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

# No --preset/--agents/--scope: --default alone must fully resolve the run.
# `< /dev/null` asserts it never blocks waiting on a prompt.
AGENT_KIT_SKIP_PLUGIN_INSTALL=1 "$KIT_ROOT/bin/agent-kit" init --default < /dev/null \
  || { fail "agent-kit init --default exited non-zero"; exit 1; }

# Default scope is global → artifacts land where Claude Code reads them.
assert_file_exists "$HOME/.claude/CLAUDE.md" "global CLAUDE.md written by --default"
assert_content_contains "$HOME/.claude/CLAUDE.md" "Core Instructions" "core instruction present"
assert_dir_nonempty "$HOME/.claude/skills" "global skills deployed"
# loop-full-swe is in the default pre-checked preset set, so its engine lands.
assert_file_exists "$HOME/.claude/skills/loop-full-swe/loop-swe.js" "default preset set deployed (loop-full-swe)"

# An explicit flag overrides the matching default while the rest stay default.
WORK2="$(mktemp -d)"
cd "$WORK2"
git init -q .
AGENT_KIT_SKIP_PLUGIN_INSTALL=1 "$KIT_ROOT/bin/agent-kit" init --default --scope repo < /dev/null \
  || { fail "agent-kit init --default --scope repo exited non-zero"; exit 1; }
assert_file_exists "$WORK2/CLAUDE.md" "repo-scoped CLAUDE.md when --scope repo overrides the default"
assert_dir_nonempty "$WORK2/.claude/skills" "repo-scoped skills deployed under --default --scope repo"
rm -rf "$WORK2"
