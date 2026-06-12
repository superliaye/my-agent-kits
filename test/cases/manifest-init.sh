#!/usr/bin/env bash
# init writes a durable, agent-neutral install manifest at ~/.agent-kit/manifest.json
# recording the selection (skills/instructions/plugins/bundles) and kit version.
# The manifest is the source of truth `update` replays; it lives in HOME (durable
# state), NOT under the disposable bundle cache root.
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

# Isolate BOTH HOME and USERPROFILE (node's os.homedir() reads USERPROFILE on
# Windows) so the manifest + global writes land in a throwaway dir.
TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

export AGENT_KIT_SKIP_PLUGIN_INSTALL=1 AGENT_KIT_SKIP_BUNDLE_INSTALL=1

"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents codex \
  || { fail "agent-kit init exited non-zero"; exit 1; }

MANIFEST="$HOME/.agent-kit/manifest.json"
assert_file_exists "$MANIFEST" "install manifest written by init"
assert_content_contains "$MANIFEST" "\"kitVersion\"" "manifest records kitVersion"
assert_content_contains "$MANIFEST" "codex" "manifest records selected agents"
assert_content_contains "$MANIFEST" "my-commit" "manifest records a selected skill"
assert_content_contains "$MANIFEST" "core" "manifest records a selected instruction"

# Durable state, not under the disposable cache root.
if [ -d "$HOME/AppData/Local/agent-kit/bundles/manifest.json" ] || [ -f "$HOME/.cache/agent-kit/manifest.json" ]; then
  fail "manifest must not live under the disposable bundle cache root"
else
  ok "manifest lives in durable ~/.agent-kit, not the cache root"
fi
