#!/usr/bin/env bash
# Verify the selected Matt catalog as authored and after isolated deployment.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

TMPROOT="$(mktemp -d)"
trap "rm -rf '$TMPROOT'" EXIT

if node "$HERE/../lib/matt-catalog.mjs" source; then
  ok "Matt catalog source, metadata, dependencies, and customized wiring"
else
  fail "Matt catalog source, metadata, dependencies, or customized wiring"
fi

deploy_and_validate() {
  local preset="$1"
  local hosts="$2"
  local home="$TMPROOT/$preset-home"
  local work="$TMPROOT/$preset-work"
  mkdir -p "$home" "$work"
  git -C "$work" init -q .

  if HOME="$home" USERPROFILE="$home" AGENT_KIT_SKIP_PLUGIN_INSTALL=1 AGENT_KIT_SKIP_BUNDLE_INSTALL=1 \
    "$KIT_ROOT/bin/agent-kit" init --preset "$preset" --agents "$hosts"; then
    ok "$preset deploy for $hosts"
  else
    fail "$preset deploy for $hosts exited non-zero"
    return
  fi

  if node "$HERE/../lib/matt-catalog.mjs" deployed "$home" "$preset" "$hosts"; then
    ok "$preset Matt selection, companions, exclusions, and Codex sidecars"
  else
    fail "$preset Matt selection, companions, exclusions, or Codex sidecars"
  fi
}

deploy_and_validate engineering claude,codex
deploy_and_validate productivity claude
deploy_and_validate loop claude

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
