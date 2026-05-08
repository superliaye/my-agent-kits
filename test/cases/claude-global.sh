#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

agent-kit init --preset personal --agents claude --scope global --yes \
  || { fail "agent-kit init --scope global exited non-zero"; exit 1; }

assert_dir_nonempty "$HOME/.claude/rules"    "global rules"
assert_dir_nonempty "$HOME/.claude/commands" "global commands"
