#!/usr/bin/env bash
# Bare `update` (no --current) must NOT prompt when there's no TTY — piped/CI
# contexts fall back to replay so the command never hangs. Redirecting stdout to
# a file makes it non-TTY deterministically, regardless of how the suite is run.
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

export AGENT_KIT_SKIP_PLUGIN_INSTALL=1 AGENT_KIT_SKIP_BUNDLE_INSTALL=1

"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents codex \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Drift, then bare `update` with stdout redirected (non-TTY) + stdin closed.
# It must replay and restore without blocking on a prompt.
rm "$HOME/.agents/skills/my-commit/SKILL.md"
OUT="$(mktemp)"
"$KIT_ROOT/bin/agent-kit" update > "$OUT" 2>&1 < /dev/null \
  || { fail "bare update (non-TTY) exited non-zero"; cat "$OUT"; exit 1; }
ok "bare update replayed under non-TTY (no hang)"

assert_file_exists "$HOME/.agents/skills/my-commit/SKILL.md" "non-TTY update restored the deployed skill"
# Replay path: no interactive wizard banner.
if grep -q "adjust your current selection" "$OUT"; then
  fail "non-TTY update must not enter the interactive wizard"
else
  ok "non-TTY update took the replay path, not the wizard"
fi
