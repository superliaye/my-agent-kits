#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents claude --scope global \
  || { fail "agent-kit init --scope global exited non-zero"; exit 1; }

# Positive: what should land at user-scope locations Claude Code reads
assert_file_exists "$HOME/.claude/CLAUDE.md" "global CLAUDE.md (instructions concatenated)"
assert_content_contains "$HOME/.claude/CLAUDE.md" "Core Instructions" "core instruction in global CLAUDE.md"
assert_dir_nonempty "$HOME/.claude/skills" "global skills deployed"
assert_file_exists "$HOME/.claude/skills/my-commit/SKILL.md" "specific skill (my-commit) deployed"

# Negative: no APM artifacts at user scope either
if [ -f "$HOME/.apm/apm.yml" ]; then fail "~/.apm/apm.yml should not be written"; else ok "no ~/.apm/apm.yml created"; fi
if [ -d "$HOME/.claude/rules" ]; then fail "~/.claude/rules/ should not be created"; else ok "no ~/.claude/rules/ created"; fi
