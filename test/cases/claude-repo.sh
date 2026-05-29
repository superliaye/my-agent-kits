#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents claude --scope repo \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Positive: what should land in the consumer repo
assert_file_exists "$WORK/CLAUDE.md" "CLAUDE.md (thin @AGENTS.md import)"
assert_content_contains "$WORK/CLAUDE.md" "@AGENTS.md" "CLAUDE.md imports canonical AGENTS.md"
assert_content_contains "$WORK/AGENTS.md" "Core Instructions" "core instruction in canonical AGENTS.md"
assert_dir_nonempty "$WORK/.claude/skills" "skills deployed to .claude/skills"
assert_file_exists "$WORK/.claude/skills/my-commit/SKILL.md" "specific skill (my-commit) deployed"
assert_file_exists "$WORK/.agent-kit.yaml" "state file"
assert_content_contains "$WORK/.agent-kit.yaml" "preset: engineering" "preset recorded"
assert_content_contains "$WORK/.agent-kit.yaml" "scope: repo" "scope recorded"

# Negative: APM artifacts should NOT exist (v0.6+ wizard bypasses apm entirely)
if [ -f "$WORK/apm.yml" ]; then fail "apm.yml should not be written"; else ok "no apm.yml created"; fi
if [ -d "$WORK/apm_modules" ]; then fail "apm_modules/ should not be created"; else ok "no apm_modules/ created"; fi
if [ -d "$WORK/.claude/rules" ]; then fail ".claude/rules/ should not be created (Claude reads CLAUDE.md)"; else ok "no .claude/rules/ created"; fi
