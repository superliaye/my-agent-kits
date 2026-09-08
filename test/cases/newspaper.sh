#!/usr/bin/env bash
# Deploy and exercise the newspaper skill as a self-contained local service.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

TMPROOT="$(mktemp -d)"
trap "rm -rf '$TMPROOT'" EXIT

deploy_case() {
  local preset="$1"
  local home="$TMPROOT/$preset-home"
  local work="$TMPROOT/$preset-work"
  mkdir -p "$home" "$work"
  git -C "$work" init -q .
  if HOME="$home" USERPROFILE="$home" AGENT_KIT_SKIP_PLUGIN_INSTALL=1 AGENT_KIT_SKIP_BUNDLE_INSTALL=1 \
    "$KIT_ROOT/bin/agent-kit" init --preset "$preset" --agents claude,codex >/dev/null; then
    ok "$preset deploys newspaper for Claude and Codex"
  else
    fail "$preset newspaper deploy failed"
    return
  fi
  for root in "$home/.claude/skills/newspaper" "$home/.agents/skills/newspaper"; do
    assert_file_exists "$root/SKILL.md" "$preset $(basename "$(dirname "$(dirname "$root")")") newspaper entrypoint"
    assert_file_exists "$root/scripts/newspaper.mjs" "$preset newspaper launcher"
    assert_file_exists "$root/runtime/index.html" "$preset newspaper HTML"
    assert_file_exists "$root/runtime/app.js" "$preset newspaper JavaScript"
    assert_file_exists "$root/runtime/app.css" "$preset newspaper CSS"
    assert_file_exists "$root/runtime/react-flow.css" "$preset bundled React Flow CSS"
    assert_file_exists "$root/runtime/canvas-model.mjs" "$preset canonical canvas model"
    assert_file_exists "$root/references/canvas-schema.md" "$preset newspaper schema reference"
    assert_content_contains "$root/SKILL.md" "added_in: 0.48.0" "$preset newspaper version"
  done
}

deploy_case engineering
deploy_case productivity
deploy_case loop

RUNTIME_HOME="$TMPROOT/runtime-home"
RUNTIME_WORK="$TMPROOT/runtime-work"
mkdir -p "$RUNTIME_HOME" "$RUNTIME_WORK"
git -C "$RUNTIME_WORK" init -q .
if HOME="$RUNTIME_HOME" USERPROFILE="$RUNTIME_HOME" AGENT_KIT_SKIP_PLUGIN_INSTALL=1 AGENT_KIT_SKIP_BUNDLE_INSTALL=1 \
  "$KIT_ROOT/bin/agent-kit" init --preset engineering --agents claude,codex >/dev/null; then
  ok "newspaper isolated runtime deployment"
else
  fail "newspaper isolated runtime deployment failed"
fi

DEPLOYED="$RUNTIME_HOME/.agents/skills/newspaper"
assert_content_contains "$DEPLOYED/runtime/app.source.jsx" "from '@xyflow/react'" "newspaper authors its renderer with React Flow"
assert_content_contains "$DEPLOYED/runtime/app.js" "ReactFlow" "newspaper ships the bundled React Flow runtime"
if grep -R -E '(src|href)=["'\'' ]*https?://|npm (install|add)|npx ' "$DEPLOYED/runtime" "$DEPLOYED/scripts" >/dev/null; then
  fail "newspaper runtime references package installation or network assets"
else
  ok "newspaper runtime is self-contained"
fi

if (cd "$RUNTIME_WORK" && HOME="$RUNTIME_HOME" NEWSPAPER_SKILL="$DEPLOYED" node "$HERE/../lib/newspaper-runtime.mjs"); then
  ok "newspaper runtime, schema, synchronization, and lifecycle contract"
else
  fail "newspaper runtime, schema, synchronization, or lifecycle contract"
fi

assert_content_contains "$KIT_ROOT/capabilities/snippets/forwardable-local-service.md" "127.0.0.1" "forwardable service loopback contract"
if grep -R -i 'arca' "$KIT_ROOT/capabilities/skills/@my-productivity/newspaper" >/dev/null; then
  fail "newspaper skill contains Arca-specific content"
else
  ok "newspaper skill remains host-independent"
fi
if grep -F 'include: forwardable-local-service' "$KIT_ROOT/capabilities/skills/@my-productivity/newspaper/SKILL.md" >/dev/null; then
  fail "newspaper skill inlines the forwarding snippet"
else
  ok "forwarding snippet stays separate from newspaper"
fi

[ "$FAIL" -eq 0 ]
