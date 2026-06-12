#!/usr/bin/env bash
# `update` is a pure replay of the manifest. With no manifest (fresh machine, or
# a pre-0.27 user who never re-ran init), it has no selection to replay, so it
# must refuse with an actionable error and deploy nothing.
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

export AGENT_KIT_SKIP_PLUGIN_INSTALL=1 AGENT_KIT_SKIP_BUNDLE_INSTALL=1

OUT="$(mktemp)"
if "$KIT_ROOT/bin/agent-kit" update > "$OUT" 2>&1; then
  fail "update with no manifest must exit non-zero"
else
  ok "update with no manifest exits non-zero"
fi

assert_content_contains "$OUT" "manifest" "error message mentions the missing manifest"
assert_content_contains "$OUT" "init" "error message points the user at \`agent-kit init\`"

# Refused before deploying: no global artifacts written.
if [ -f "$HOME/.claude/CLAUDE.md" ] || [ -d "$HOME/.claude/skills" ]; then
  fail "update must not deploy when it refuses (no CLAUDE.md / skills)"
else
  ok "update deployed nothing when it refused"
fi
