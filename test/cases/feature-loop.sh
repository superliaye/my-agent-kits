#!/usr/bin/env bash
# Verify the new `feature-loop` preset deploys the orchestrator skill
# alongside existing supporting skills (improve-codebase-architecture, etc.).

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

"$KIT_ROOT/bin/agent-kit" init --preset feature-loop --agents claude --scope repo \
  || { fail "agent-kit init --preset feature-loop exited non-zero"; exit 1; }

# Orchestrator skill landed
assert_file_exists "$WORK/.claude/skills/feature-loop/SKILL.md" "feature-loop SKILL.md deployed"
assert_content_contains "$WORK/.claude/skills/feature-loop/SKILL.md" "Phase 4 — Code review" "Phase 4 documented"
assert_content_contains "$WORK/.claude/skills/feature-loop/SKILL.md" "depth = 1" "depth-1 constraint documented"
assert_content_contains "$WORK/.claude/skills/feature-loop/SKILL.md" "ui_work" "ui_work flag documented"

# Supporting skills the preset includes
assert_file_exists "$WORK/.claude/skills/improve-codebase-architecture/SKILL.md" "improve-codebase-architecture deployed"
assert_file_exists "$WORK/.claude/skills/my-create-pr/SKILL.md" "my-create-pr deployed"
assert_file_exists "$WORK/.claude/skills/my-fix-build/SKILL.md" "my-fix-build deployed"
assert_file_exists "$WORK/.claude/skills/diagnose/SKILL.md" "diagnose deployed"

# Core instruction concatenated
assert_file_exists "$WORK/CLAUDE.md" "CLAUDE.md generated"
assert_content_contains "$WORK/CLAUDE.md" "Core Instructions" "core instruction in CLAUDE.md"

# State recorded
assert_content_contains "$WORK/.agent-kit.yaml" "preset: feature-loop" "preset recorded"
assert_content_contains "$WORK/.agent-kit.yaml" "feature-loop" "feature-loop skill in state"

# Negative: opt-in stack-specific skills NOT in the preset
if [ -d "$WORK/.claude/skills/electron-visual-loop" ]; then
  fail "electron-visual-loop should NOT be in the feature-loop preset by default (opt-in only)"
else
  ok "electron-visual-loop correctly absent (opt-in only)"
fi
