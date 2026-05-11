#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

agent-kit init --preset personal --agents claude --scope repo --yes \
  || { fail "agent-kit init exited non-zero"; exit 1; }

assert_file_exists "$WORK/apm.yml" "apm.yml"
assert_dir_nonempty "$WORK/.claude/rules" "rules"
# Skills (v0.3 absorbs the former 'prompts' primitive). personal preset ships
# 6 skills (my-commit, my-commit-and-push, my-create-pr, my-explain,
# my-fix-build, my-clean-code). APM may deploy them at .claude/skills/ or
# .claude/agents/ (cross-client convention varies by APM version).
if [ -d "$WORK/.claude/skills" ] && [ -n "$(ls -A "$WORK/.claude/skills" 2>/dev/null)" ]; then
  ok "skills deployed to .claude/skills"
elif [ -d "$WORK/.claude/agents" ] && [ -n "$(ls -A "$WORK/.claude/agents" 2>/dev/null)" ]; then
  ok "skills deployed to .claude/agents (APM alternate placement)"
elif [ -d "$WORK/.claude/commands" ] && [ -n "$(ls -A "$WORK/.claude/commands" 2>/dev/null)" ]; then
  ok "skills deployed to .claude/commands (APM v0.12 places SKILL.md folders here for Claude)"
else
  fail "skills missing — none of .claude/skills, .claude/agents, .claude/commands populated"
fi
assert_file_exists "$WORK/.agent-kit.yaml" "state file"
assert_content_contains "$WORK/.agent-kit.yaml" "preset: personal" "preset recorded"
assert_content_contains "$WORK/.agent-kit.yaml" "scope: repo" "scope recorded"
# Plugins (v0.2): personal preset includes 'superpowers'.
# Even with scope=repo, plugins always install at user scope.
assert_file_exists "$HOME/.claude/plugins/installed_plugins.json" "plugins state file"
assert_content_contains "$HOME/.claude/plugins/installed_plugins.json" "superpowers" "superpowers plugin installed (user scope)"
