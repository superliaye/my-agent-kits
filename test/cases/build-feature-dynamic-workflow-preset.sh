#!/usr/bin/env bash
# Verify the `build-feature-dynamic-workflow` preset deploys the skill (SKILL.md,
# workflow-spec.md, reference seed) + all its supporting skills, and records the
# right plugin set in .agent-kit.yaml.
#
# AGENT_KIT_SKIP_PLUGIN_INSTALL=1 prevents touching the live Claude
# Code plugin set.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

AGENT_KIT_SKIP_PLUGIN_INSTALL=1 "$KIT_ROOT/bin/agent-kit" init \
  --preset build-feature-dynamic-workflow --agents claude --scope repo \
  || { fail "agent-kit init --preset build-feature-dynamic-workflow exited non-zero"; exit 1; }

# Skill artifacts landed (full recursive folder copy)
assert_file_exists "$WORK/.claude/skills/build-feature-dynamic-workflow/SKILL.md" "build-feature-dynamic-workflow SKILL.md deployed"
assert_file_exists "$WORK/.claude/skills/build-feature-dynamic-workflow/workflow-spec.md" "build-feature-dynamic-workflow workflow-spec.md deployed"
assert_file_exists "$WORK/.claude/skills/build-feature-dynamic-workflow/reference/build-feature-dynamic-workflow.js" "build-feature-dynamic-workflow reference seed deployed"

# SKILL.md describes the dynamic-workflow engine + single-run adaptation
assert_content_contains "$WORK/.claude/skills/build-feature-dynamic-workflow/SKILL.md" "dynamic-workflow" "SKILL.md mentions dynamic-workflow runtime"
assert_content_contains "$WORK/.claude/skills/build-feature-dynamic-workflow/SKILL.md" "decisions report" "SKILL.md describes report-at-end decisions"
assert_content_contains "$WORK/.claude/skills/build-feature-dynamic-workflow/workflow-spec.md" "Decisions protocol" "spec defines the Decisions protocol"

# Frontmatter so the primitive catalog discovers it like every other skill
assert_content_contains "$WORK/.claude/skills/build-feature-dynamic-workflow/SKILL.md" "added_in:" "frontmatter has added_in"
assert_content_contains "$WORK/.claude/skills/build-feature-dynamic-workflow/SKILL.md" "description:" "frontmatter has description"

# Reference seed is honestly labeled as unverified API (so no one ships it blind)
assert_content_contains "$WORK/.claude/skills/build-feature-dynamic-workflow/reference/build-feature-dynamic-workflow.js" "UNVERIFIED API" "reference seed flags unverified API"

# Supporting skills the preset includes (same set as build-feature-workflow)
assert_file_exists "$WORK/.claude/skills/e2e-validate/SKILL.md" "e2e-validate deployed"
assert_file_exists "$WORK/.claude/skills/improve-codebase-architecture/SKILL.md" "improve-codebase-architecture deployed"
assert_file_exists "$WORK/.claude/skills/improve-DDD-architecture/SKILL.md" "improve-DDD-architecture deployed"
assert_file_exists "$WORK/.claude/skills/design-critique/SKILL.md" "design-critique deployed"
assert_file_exists "$WORK/.claude/skills/diagnose/SKILL.md" "diagnose deployed"
assert_file_exists "$WORK/.claude/skills/electron-visual-loop/SKILL.md" "electron-visual-loop deployed"
assert_file_exists "$WORK/.claude/skills/web-visual-loop/SKILL.md" "web-visual-loop deployed"

# Core instruction lives in the canonical AGENTS.md; CLAUDE.md imports it.
assert_file_exists "$WORK/CLAUDE.md" "CLAUDE.md generated"
assert_content_contains "$WORK/CLAUDE.md" "@AGENTS.md" "CLAUDE.md imports canonical AGENTS.md"
assert_content_contains "$WORK/AGENTS.md" "Core Instructions" "core instruction in canonical AGENTS.md"

# State recorded — preset + plugins
assert_content_contains "$WORK/.agent-kit.yaml" "preset: build-feature-dynamic-workflow" "preset recorded"
assert_content_contains "$WORK/.agent-kit.yaml" "build-feature-dynamic-workflow" "skill in state"
assert_content_contains "$WORK/.agent-kit.yaml" "ui-ux-pro-max" "ui-ux-pro-max plugin in state"
assert_content_contains "$WORK/.agent-kit.yaml" "frontend-design" "frontend-design plugin in state"

# Negative: code-review plugin NOT in this preset (mirrors build-feature-workflow)
if grep -q "code-review" "$WORK/.agent-kit.yaml"; then
  fail "code-review should NOT be in build-feature-dynamic-workflow preset"
else
  ok "code-review correctly absent from build-feature-dynamic-workflow preset"
fi
