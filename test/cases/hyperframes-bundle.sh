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

# Same skip-install pattern as gstack-bundle.sh: AGENT_KIT_SKIP_BUNDLE_INSTALL=1
# skips the real `npx skills add` (which would fetch hyperframes' skill bundle
# from npm). This validates the kit-side scaffolding only: bundle metadata loads,
# the productivity preset's bundle list is honored, npx-skills kind is dispatched.
export AGENT_KIT_SKIP_BUNDLE_INSTALL=1

"$KIT_ROOT/bin/agent-kit" init --preset productivity --agents claude --bundles hyperframes \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Positive: productivity preset's content lands globally.
assert_file_exists "$HOME/.claude/CLAUDE.md" "global CLAUDE.md"
assert_content_contains "$HOME/.claude/CLAUDE.md" "Core Instructions" "core instruction in global CLAUDE.md"
assert_dir_nonempty "$HOME/.claude/skills" "skills deployed to global ~/.claude/skills"
assert_file_exists "$HOME/.claude/skills/grill-me/SKILL.md" "productivity skill (grill-me) deployed globally"

# Negative: APM artifacts should NOT exist
if [ -f "$WORK/apm.yml" ]; then fail "apm.yml should not be written"; else ok "no apm.yml created"; fi
if [ -d "$WORK/apm_modules" ]; then fail "apm_modules/ should not be created"; else ok "no apm_modules/ created"; fi

# Bundles always install globally (~/.claude/skills/hyperframes/); assert nothing
# hyperframes-shaped leaked into the consumer repo.
if [ -d "$WORK/.claude/skills/hyperframes" ]; then
  fail "hyperframes should install globally, not into the consumer repo at .claude/skills/hyperframes/"
else
  ok "no hyperframes/ directory leaked into consumer repo"
fi
