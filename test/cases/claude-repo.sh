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
assert_dir_nonempty "$WORK/.claude/commands" "commands"
# Skills coverage: personal preset includes 'code-review' skill.
# APM may deploy skills as either .claude/skills/<name>/ or .claude/agents/<name>.md.
# Either is valid evidence the skill primitive made it through; require at least one.
if [ -d "$WORK/.claude/skills" ] && [ -n "$(ls -A "$WORK/.claude/skills" 2>/dev/null)" ]; then
  ok "skills deployed to .claude/skills"
elif [ -d "$WORK/.claude/agents" ] && [ -n "$(ls -A "$WORK/.claude/agents" 2>/dev/null)" ]; then
  ok "skills deployed to .claude/agents (APM alternate placement)"
else
  fail "skills missing — neither .claude/skills nor .claude/agents non-empty"
fi
assert_file_exists "$WORK/.agent-kit.yaml" "state file"
assert_content_contains "$WORK/.agent-kit.yaml" "preset: personal" "preset recorded"
assert_content_contains "$WORK/.agent-kit.yaml" "scope: repo" "scope recorded"
