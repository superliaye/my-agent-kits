#!/usr/bin/env bash
# Verify the `feature-loop` preset deploys the orchestrator skill and its
# supporting skills (incl. electron-visual-loop) globally.
#
# AGENT_KIT_SKIP_PLUGIN_INSTALL=1 prevents the test from actually mutating
# the dev environment's Claude Code plugin set.

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

AGENT_KIT_SKIP_PLUGIN_INSTALL=1 "$KIT_ROOT/bin/agent-kit" init \
  --preset feature-loop --agents claude \
  || { fail "agent-kit init --preset feature-loop exited non-zero"; exit 1; }

# Orchestrator skill landed
assert_file_exists "$HOME/.claude/skills/feature-loop/SKILL.md" "feature-loop SKILL.md deployed"
assert_content_contains "$HOME/.claude/skills/feature-loop/SKILL.md" "Phase 4 — Code review" "Phase 4 documented"
assert_content_contains "$HOME/.claude/skills/feature-loop/SKILL.md" "depth = 1" "depth-1 constraint documented"
assert_content_contains "$HOME/.claude/skills/feature-loop/SKILL.md" "ui_work" "ui_work flag documented"

# Supporting skills the preset includes
assert_file_exists "$HOME/.claude/skills/improve-codebase-architecture/SKILL.md" "improve-codebase-architecture deployed"
assert_file_exists "$HOME/.claude/skills/diagnose/SKILL.md" "diagnose deployed"
assert_file_exists "$HOME/.claude/skills/electron-visual-loop/SKILL.md" "electron-visual-loop deployed (Phase 5a Electron)"
assert_file_exists "$HOME/.claude/skills/web-visual-loop/SKILL.md" "web-visual-loop deployed (Phase 5a web)"
assert_file_exists "$HOME/.claude/skills/design-critique/SKILL.md" "design-critique deployed (Phase 5b)"

# Core instruction lives in the global CLAUDE.md.
assert_file_exists "$HOME/.claude/CLAUDE.md" "global CLAUDE.md generated"
assert_content_contains "$HOME/.claude/CLAUDE.md" "Core Instructions" "core instruction in global CLAUDE.md"

# Negative: my-* skills NOT in the preset (never asked for by the user)
for s in my-create-pr my-fix-build my-clean-code my-commit my-commit-and-push my-explain; do
  if [ -d "$HOME/.claude/skills/$s" ]; then
    fail "$s should NOT be in feature-loop preset"
  else
    ok "$s correctly absent from feature-loop preset"
  fi
done
