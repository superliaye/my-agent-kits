#!/usr/bin/env bash
# Verify the `loop-full-swe` preset deploys all 4 loop skills + the single shared
# engine (loop-swe.js, which lives only in the uber skill's folder and is launched
# by all four), plus the supporting skills.
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

AGENT_KIT_SKIP_PLUGIN_INSTALL=1 "$KIT_ROOT/bin/agent-kit" init \
  --preset loop-full-swe --agents claude \
  || { fail "agent-kit init --preset loop-full-swe exited non-zero"; exit 1; }

# All 4 loop skills land (full recursive folder copy)
assert_file_exists "$HOME/.claude/skills/loop-full-swe/SKILL.md" "loop-full-swe SKILL.md deployed"
assert_file_exists "$HOME/.claude/skills/loop-research-plan/SKILL.md" "loop-research-plan SKILL.md deployed"
assert_file_exists "$HOME/.claude/skills/loop-swe-build/SKILL.md" "loop-swe-build SKILL.md deployed"
assert_file_exists "$HOME/.claude/skills/loop-retro/SKILL.md" "loop-retro SKILL.md deployed"

# The shared engine ships ONCE, inside the uber skill's folder (single source of truth)
assert_file_exists "$HOME/.claude/skills/loop-full-swe/loop-swe.js" "shared engine loop-swe.js deployed in uber skill folder"
assert_content_contains "$HOME/.claude/skills/loop-full-swe/loop-swe.js" "export const meta" "engine is a real dynamic-workflow script (export const meta)"
assert_content_contains "$HOME/.claude/skills/loop-full-swe/loop-swe.js" "needsHuman" "engine implements the self-digest gate"

# ...and NOT duplicated into the stage skills' folders
if [ -f "$HOME/.claude/skills/loop-swe-build/loop-swe.js" ]; then
  fail "loop-swe.js should NOT be duplicated into loop-swe-build (single source of truth)"
else
  ok "engine not duplicated into loop-swe-build (references the uber's copy)"
fi

# Stage skills reference the shared engine by sibling path
assert_content_contains "$HOME/.claude/skills/loop-swe-build/SKILL.md" "loop-full-swe/loop-swe.js" "loop-swe-build references the shared engine path"
assert_content_contains "$HOME/.claude/skills/loop-research-plan/SKILL.md" "stopAfter" "loop-research-plan launches the plan-only stage"

# Frontmatter so the capability catalog discovers each like every other skill
for s in loop-full-swe loop-research-plan loop-swe-build loop-retro; do
  assert_content_contains "$HOME/.claude/skills/$s/SKILL.md" "added_in:" "$s frontmatter has added_in"
  assert_content_contains "$HOME/.claude/skills/$s/SKILL.md" "description:" "$s frontmatter has description"
done

# Supporting skills the preset includes
assert_file_exists "$HOME/.claude/skills/e2e-validate/SKILL.md" "e2e-validate deployed"
assert_file_exists "$HOME/.claude/skills/improve-codebase-architecture/SKILL.md" "improve-codebase-architecture deployed"
assert_file_exists "$HOME/.claude/skills/improve-DDD-architecture/SKILL.md" "improve-DDD-architecture deployed"
assert_file_exists "$HOME/.claude/skills/design-critique/SKILL.md" "design-critique deployed"
assert_file_exists "$HOME/.claude/skills/diagnose/SKILL.md" "diagnose deployed"
assert_file_exists "$HOME/.claude/skills/electron-visual-loop/SKILL.md" "electron-visual-loop deployed"
assert_file_exists "$HOME/.claude/skills/web-visual-loop/SKILL.md" "web-visual-loop deployed"
assert_file_exists "$HOME/.claude/skills/to-issues/SKILL.md" "to-issues deployed"

# SOURCE.md is maintainer-only upstream provenance — it must NOT deploy
# (electron-visual-loop carries one, having been copied from an upstream repo).
if [ -f "$HOME/.claude/skills/electron-visual-loop/SOURCE.md" ]; then
  fail "SOURCE.md should be excluded from deployed skill"
else
  ok "SOURCE.md excluded from deployed skill"
fi

# Core instruction lives in the global CLAUDE.md.
assert_file_exists "$HOME/.claude/CLAUDE.md" "global CLAUDE.md generated"
assert_content_contains "$HOME/.claude/CLAUDE.md" "Core Instructions" "core instruction in global CLAUDE.md"
