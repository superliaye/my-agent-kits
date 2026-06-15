#!/usr/bin/env bash
# Verify the experimenting-engineering preset deploys wf-research — the file-based
# research-brief Workflow — including its launcher SKILL.md and the workflow script
# it launches.
#
# AGENT_KIT_SKIP_PLUGIN_INSTALL=1 keeps the live Claude Code plugin set untouched
# (experimenting-engineering pulls in the superpowers plugin).

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
  --preset experimenting-engineering --agents claude \
  || { fail "agent-kit init --preset experimenting-engineering exited non-zero"; exit 1; }

# wf-research lands as a folder skill: the launcher + the workflow script it launches.
assert_file_exists "$HOME/.claude/skills/wf-research/SKILL.md" "wf-research SKILL.md deployed"
assert_file_exists "$HOME/.claude/skills/wf-research/wf-research.workflow.js" "wf-research workflow script deployed"
assert_content_contains "$HOME/.claude/skills/wf-research/wf-research.workflow.js" "export const meta" "workflow is a real dynamic-workflow script (export const meta)"

# Frontmatter so the capability catalog discovers it like every other skill.
assert_content_contains "$HOME/.claude/skills/wf-research/SKILL.md" "added_in:" "wf-research frontmatter has added_in"
assert_content_contains "$HOME/.claude/skills/wf-research/SKILL.md" "description:" "wf-research frontmatter has description"
