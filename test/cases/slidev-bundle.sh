#!/usr/bin/env bash
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

# Same skip-install pattern as hyperframes-bundle.sh: AGENT_KIT_SKIP_BUNDLE_INSTALL=1
# skips the real `npx skills add` (which would fetch the Slidev skill bundle from
# npm). This validates the kit-side scaffolding only: the slidev bundle metadata
# loads as an npx-skills bundle, the bundle list is honored, and the kit-side
# dispatch writes nothing into the consumer repo.
export AGENT_KIT_SKIP_BUNDLE_INSTALL=1

# Bundle dispatch + no-leak: init with --bundles slidev exits zero (the npx-skills
# kind is dispatched; skip-install means no real npx runs).
"$KIT_ROOT/bin/agent-kit" init --preset productivity --agents claude --bundles slidev \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Positive: productivity preset's content lands globally.
assert_file_exists "$HOME/.claude/CLAUDE.md" "global CLAUDE.md"
assert_content_contains "$HOME/.claude/CLAUDE.md" "Core Instructions" "core instruction in global CLAUDE.md"
assert_dir_nonempty "$HOME/.claude/skills" "skills deployed to global ~/.claude/skills"

# Bundles always install globally (~/.claude/skills/slidev/); under skip-install
# the kit-side dispatch must write nothing into the consumer repo.
if [ -d "$WORK/.claude/skills/slidev" ]; then
  fail "slidev should install globally, not into the consumer repo at .claude/skills/slidev/"
else
  ok "no slidev/ directory leaked into consumer repo"
fi

# Kit-native files deploy: the productivity preset ships the
# my-slidev skill + my-slidev-agent agent to their global paths.
assert_file_exists "$HOME/.claude/skills/my-slidev/SKILL.md" "my-slidev skill deployed globally"
assert_file_exists "$HOME/.claude/agents/my-slidev-agent.md" "my-slidev-agent deployed globally"
