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
assert_file_exists "$WORK/.agent-kit.yaml" "state file"
assert_content_contains "$WORK/.agent-kit.yaml" "preset: personal" "preset recorded"
assert_content_contains "$WORK/.agent-kit.yaml" "scope: repo" "scope recorded"
