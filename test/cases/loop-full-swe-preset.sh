#!/usr/bin/env bash
# Verify the `loop-full-swe` preset deploys all 4 loop skills + the single shared
# engine (loop-swe.js, which lives only in the uber skill's folder and is launched
# by all four), plus the supporting skills, and records the right plugin set.
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

AGENT_KIT_SKIP_PLUGIN_INSTALL=1 "$KIT_ROOT/bin/agent-kit" init \
  --preset loop-full-swe --agents claude --scope repo \
  || { fail "agent-kit init --preset loop-full-swe exited non-zero"; exit 1; }

# All 4 loop skills land (full recursive folder copy)
assert_file_exists "$WORK/.claude/skills/loop-full-swe/SKILL.md" "loop-full-swe SKILL.md deployed"
assert_file_exists "$WORK/.claude/skills/loop-research-plan/SKILL.md" "loop-research-plan SKILL.md deployed"
assert_file_exists "$WORK/.claude/skills/loop-build/SKILL.md" "loop-build SKILL.md deployed"
assert_file_exists "$WORK/.claude/skills/loop-retro/SKILL.md" "loop-retro SKILL.md deployed"

# The shared engine ships ONCE, inside the uber skill's folder (single source of truth)
assert_file_exists "$WORK/.claude/skills/loop-full-swe/loop-swe.js" "shared engine loop-swe.js deployed in uber skill folder"
assert_content_contains "$WORK/.claude/skills/loop-full-swe/loop-swe.js" "export const meta" "engine is a real dynamic-workflow script (export const meta)"
assert_content_contains "$WORK/.claude/skills/loop-full-swe/loop-swe.js" "needsHuman" "engine implements the self-digest gate"

# ...and NOT duplicated into the stage skills' folders
if [ -f "$WORK/.claude/skills/loop-build/loop-swe.js" ]; then
  fail "loop-swe.js should NOT be duplicated into loop-build (single source of truth)"
else
  ok "engine not duplicated into loop-build (references the uber's copy)"
fi

# Stage skills reference the shared engine by sibling path
assert_content_contains "$WORK/.claude/skills/loop-build/SKILL.md" "loop-full-swe/loop-swe.js" "loop-build references the shared engine path"
assert_content_contains "$WORK/.claude/skills/loop-research-plan/SKILL.md" "stopAfter" "loop-research-plan launches the plan-only stage"

# Frontmatter so the primitive catalog discovers each like every other skill
for s in loop-full-swe loop-research-plan loop-build loop-retro; do
  assert_content_contains "$WORK/.claude/skills/$s/SKILL.md" "added_in:" "$s frontmatter has added_in"
  assert_content_contains "$WORK/.claude/skills/$s/SKILL.md" "description:" "$s frontmatter has description"
done

# Supporting skills the preset includes
assert_file_exists "$WORK/.claude/skills/e2e-validate/SKILL.md" "e2e-validate deployed"
assert_file_exists "$WORK/.claude/skills/improve-codebase-architecture/SKILL.md" "improve-codebase-architecture deployed"
assert_file_exists "$WORK/.claude/skills/improve-DDD-architecture/SKILL.md" "improve-DDD-architecture deployed"
assert_file_exists "$WORK/.claude/skills/design-critique/SKILL.md" "design-critique deployed"
assert_file_exists "$WORK/.claude/skills/diagnose/SKILL.md" "diagnose deployed"
assert_file_exists "$WORK/.claude/skills/electron-visual-loop/SKILL.md" "electron-visual-loop deployed"
assert_file_exists "$WORK/.claude/skills/web-visual-loop/SKILL.md" "web-visual-loop deployed"
assert_file_exists "$WORK/.claude/skills/to-issues/SKILL.md" "to-issues deployed"

# Core instruction lives in the canonical AGENTS.md; CLAUDE.md imports it.
assert_file_exists "$WORK/CLAUDE.md" "CLAUDE.md generated"
assert_content_contains "$WORK/CLAUDE.md" "@AGENTS.md" "CLAUDE.md imports canonical AGENTS.md"
assert_content_contains "$WORK/AGENTS.md" "Core Instructions" "core instruction in canonical AGENTS.md"

# State recorded — preset + plugins
assert_content_contains "$WORK/.agent-kit.yaml" "preset: loop-full-swe" "preset recorded"
assert_content_contains "$WORK/.agent-kit.yaml" "loop-full-swe" "uber skill in state"
assert_content_contains "$WORK/.agent-kit.yaml" "ui-ux-pro-max" "ui-ux-pro-max plugin in state"
assert_content_contains "$WORK/.agent-kit.yaml" "frontend-design" "frontend-design plugin in state"
