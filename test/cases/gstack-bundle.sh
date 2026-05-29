#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

# Skip the actual clone + gstack setup (would download Chromium etc. — slow,
# brittle, and unnecessary to validate kit-side scaffolding). Asserts focus on
# what the kit guarantees: preset loads, bundle is recorded in state, the
# engineering primitives still land, no APM artifacts leak.
export AGENT_KIT_SKIP_BUNDLE_INSTALL=1

"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents claude --scope repo --bundles gstack \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Positive: engineering preset content still lands
assert_file_exists "$WORK/CLAUDE.md" "CLAUDE.md (thin @AGENTS.md import)"
assert_content_contains "$WORK/CLAUDE.md" "@AGENTS.md" "CLAUDE.md imports canonical AGENTS.md"
assert_content_contains "$WORK/AGENTS.md" "Core Instructions" "core instruction in canonical AGENTS.md"
assert_dir_nonempty "$WORK/.claude/skills" "skills deployed to .claude/skills"
assert_file_exists "$WORK/.claude/skills/my-commit/SKILL.md" "engineering skill (my-commit) deployed"

# Bundle-specific assertions
assert_file_exists "$WORK/.agent-kit.yaml" "state file"
assert_content_contains "$WORK/.agent-kit.yaml" "preset: engineering" "preset recorded"
# Needle indented to avoid grep parsing the leading dash as a flag.
assert_content_contains "$WORK/.agent-kit.yaml" "    - gstack" "bundle recorded in state"
assert_content_contains "$WORK/.agent-kit.yaml" "bundle_commits:" "bundle_commits key present"
assert_content_contains "$WORK/.agent-kit.yaml" "gstack: dc6252d1df7f1f650ea6e9b2bba7d08fab5de902" "bundle pinned commit recorded"

# Negative: APM artifacts should NOT exist
if [ -f "$WORK/apm.yml" ]; then fail "apm.yml should not be written"; else ok "no apm.yml created"; fi
if [ -d "$WORK/apm_modules" ]; then fail "apm_modules/ should not be created"; else ok "no apm_modules/ created"; fi

# Negative: the bundle's --prefix flag means the real install would write to
# ~/.claude/skills/gstack/, NOT into the consumer repo. Verify nothing
# gstack-shaped leaked into the repo (only relevant when skip mode is off,
# but assert anyway to catch regressions in scope handling).
if [ -d "$WORK/.claude/skills/gstack" ]; then
  fail "gstack should install globally, not into the consumer repo at .claude/skills/gstack/"
else
  ok "no gstack/ directory leaked into consumer repo"
fi
