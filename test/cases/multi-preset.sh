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

# --preset accepts a comma-separated list. The resulting primitive set is the
# union of all named presets, deduped per type.
export AGENT_KIT_SKIP_BUNDLE_INSTALL=1

"$KIT_ROOT/bin/agent-kit" init --preset engineering,productivity --agents claude --bundles hyperframes \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Both presets pull in `core` instruction; verify it lands exactly once (no
# duplicated body in the global CLAUDE.md from naive concat).
core_count=$(grep -c "^# Core Instructions$" "$HOME/.claude/CLAUDE.md" 2>/dev/null || echo 0)
if [ "$core_count" = "1" ]; then
  ok "core instruction deduped across presets (one occurrence in global CLAUDE.md)"
else
  fail "core instruction not deduped (found $core_count occurrences of '# Core Instructions' header in global CLAUDE.md)"
fi

# Engineering-only contribution still present (typescript is in engineering
# but not productivity — confirms the union, not just the intersection).
assert_content_contains "$HOME/.claude/CLAUDE.md" "TypeScript Rules" "engineering's typescript instruction in global CLAUDE.md (union, not intersection)"

# Engineering-only skill present globally
assert_file_exists "$HOME/.claude/skills/my-commit/SKILL.md" "engineering skill (my-commit) deployed via multi-preset"
