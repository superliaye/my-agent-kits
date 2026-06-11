#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

# Isolate BOTH HOME and USERPROFILE so the global writes land in a throwaway dir.
TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

# Skip the actual clone + gstack setup (would download Chromium etc. — slow,
# brittle, and unnecessary to validate kit-side scaffolding). Asserts focus on
# what the kit guarantees: preset loads, the engineering primitives still land
# globally, no APM artifacts leak.
export AGENT_KIT_SKIP_BUNDLE_INSTALL=1

"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents claude --bundles gstack \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Positive: engineering preset content still lands globally
assert_file_exists "$HOME/.claude/CLAUDE.md" "global CLAUDE.md"
assert_content_contains "$HOME/.claude/CLAUDE.md" "Core Instructions" "core instruction in global CLAUDE.md"
assert_dir_nonempty "$HOME/.claude/skills" "skills deployed to global ~/.claude/skills"
assert_file_exists "$HOME/.claude/skills/my-commit/SKILL.md" "engineering skill (my-commit) deployed globally"

# Negative: APM artifacts should NOT exist
if [ -f "$WORK/apm.yml" ]; then fail "apm.yml should not be written"; else ok "no apm.yml created"; fi
if [ -d "$WORK/apm_modules" ]; then fail "apm_modules/ should not be created"; else ok "no apm_modules/ created"; fi

# Bundles always install globally (~/.claude/skills/gstack/); assert nothing
# gstack-shaped leaked into the consumer repo.
if [ -d "$WORK/.claude/skills/gstack" ]; then
  fail "gstack should install globally, not into the consumer repo at .claude/skills/gstack/"
else
  ok "no gstack/ directory leaked into consumer repo"
fi
