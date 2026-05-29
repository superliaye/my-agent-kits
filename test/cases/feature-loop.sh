#!/usr/bin/env bash
# Verify the `feature-loop` preset deploys the orchestrator skill, its
# supporting skills (incl. electron-visual-loop), and records the three
# referenced plugins (ui-ux-pro-max, frontend-design, code-review) in state.
#
# AGENT_KIT_SKIP_PLUGIN_INSTALL=1 prevents the test from actually mutating
# the dev environment's Claude Code plugin set.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

AGENT_KIT_SKIP_PLUGIN_INSTALL=1 "$KIT_ROOT/bin/agent-kit" init \
  --preset feature-loop --agents claude --scope repo \
  || { fail "agent-kit init --preset feature-loop exited non-zero"; exit 1; }

# Orchestrator skill landed
assert_file_exists "$WORK/.claude/skills/feature-loop/SKILL.md" "feature-loop SKILL.md deployed"
assert_content_contains "$WORK/.claude/skills/feature-loop/SKILL.md" "Phase 4 — Code review" "Phase 4 documented"
assert_content_contains "$WORK/.claude/skills/feature-loop/SKILL.md" "depth = 1" "depth-1 constraint documented"
assert_content_contains "$WORK/.claude/skills/feature-loop/SKILL.md" "ui_work" "ui_work flag documented"

# Supporting skills the preset includes
assert_file_exists "$WORK/.claude/skills/improve-codebase-architecture/SKILL.md" "improve-codebase-architecture deployed"
assert_file_exists "$WORK/.claude/skills/diagnose/SKILL.md" "diagnose deployed"
assert_file_exists "$WORK/.claude/skills/electron-visual-loop/SKILL.md" "electron-visual-loop deployed (Phase 5a Electron)"
assert_file_exists "$WORK/.claude/skills/web-visual-loop/SKILL.md" "web-visual-loop deployed (Phase 5a web)"
assert_file_exists "$WORK/.claude/skills/design-critique/SKILL.md" "design-critique deployed (Phase 5b)"

# Core instruction lives in the canonical AGENTS.md; CLAUDE.md imports it.
assert_file_exists "$WORK/CLAUDE.md" "CLAUDE.md generated"
assert_content_contains "$WORK/CLAUDE.md" "@AGENTS.md" "CLAUDE.md imports canonical AGENTS.md"
assert_content_contains "$WORK/AGENTS.md" "Core Instructions" "core instruction in canonical AGENTS.md"

# State recorded — preset + plugins
assert_content_contains "$WORK/.agent-kit.yaml" "preset: feature-loop" "preset recorded"
assert_content_contains "$WORK/.agent-kit.yaml" "feature-loop" "feature-loop skill in state"
assert_content_contains "$WORK/.agent-kit.yaml" "ui-ux-pro-max" "ui-ux-pro-max plugin in state"
assert_content_contains "$WORK/.agent-kit.yaml" "frontend-design" "frontend-design plugin in state"
assert_content_contains "$WORK/.agent-kit.yaml" "code-review" "code-review plugin in state"

# Negative: my-* skills NOT in the preset (never asked for by the user)
for s in my-create-pr my-fix-build my-clean-code my-commit my-commit-and-push my-explain; do
  if [ -d "$WORK/.claude/skills/$s" ]; then
    fail "$s should NOT be in feature-loop preset"
  else
    ok "$s correctly absent from feature-loop preset"
  fi
done
