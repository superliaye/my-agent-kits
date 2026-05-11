#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

agent-kit init --preset engineering --agents claude --scope global --yes \
  || { fail "agent-kit init --scope global exited non-zero"; exit 1; }

assert_dir_nonempty "$HOME/.claude/rules"    "global rules"
# v0.3: skills (formerly prompts + skills primitives unified)
if [ -d "$HOME/.claude/skills" ] && [ -n "$(ls -A "$HOME/.claude/skills" 2>/dev/null)" ]; then
  ok "global skills deployed"
elif [ -d "$HOME/.claude/agents" ] && [ -n "$(ls -A "$HOME/.claude/agents" 2>/dev/null)" ]; then
  ok "global skills deployed (alternate placement)"
elif [ -d "$HOME/.claude/commands" ] && [ -n "$(ls -A "$HOME/.claude/commands" 2>/dev/null)" ]; then
  ok "global skills deployed to .claude/commands (APM placement)"
else
  fail "global skills missing"
fi
