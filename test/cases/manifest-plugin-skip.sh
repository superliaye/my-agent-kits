#!/usr/bin/env bash
# Install-if-absent: an unchanged `update` must NOT re-run the network-bound
# plugin install for a plugin already present in installed_plugins.json. This is
# observable in the container WITHOUT a real `claude` CLI — the skip happens
# before any claude call, so we assert on stdout that update never re-enters the
# marketplace-add / install path. (Regression: update used to reinstall every
# selected plugin, e.g. ui-ux-pro-max + superpowers, on every run.)
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

export AGENT_KIT_SKIP_BUNDLE_INSTALL=1

# Seed a manifest selecting plugins (the loop preset ships ui-ux-pro-max +
# frontend-design). The plugin-skip env lets init record them without a real
# install on a box that has no claude CLI.
AGENT_KIT_SKIP_PLUGIN_INSTALL=1 "$KIT_ROOT/bin/agent-kit" init --preset loop --agents claude \
  || { fail "agent-kit init exited non-zero"; exit 1; }
assert_content_contains "$HOME/.agent-kit/manifest.json" "ui-ux-pro-max" "manifest records selected plugin"

# Mark both plugins as already installed in Claude's registry.
mkdir -p "$HOME/.claude/plugins"
cat > "$HOME/.claude/plugins/installed_plugins.json" <<'JSON'
{ "ui-ux-pro-max": { "scope": "user" }, "frontend-design": { "scope": "user" } }
JSON

# Update WITHOUT the plugin-skip env: install-if-absent must short-circuit on the
# already-present plugins (no claude call, no marketplace re-add).
OUT="$(mktemp)"
"$KIT_ROOT/bin/agent-kit" update --current > "$OUT" 2>&1 \
  || { fail "agent-kit update exited non-zero"; cat "$OUT"; exit 1; }

assert_content_contains "$OUT" "already installed; skipping" "update skips an already-installed plugin"
# The expensive/network path must NOT be entered, and we must not be in stub mode.
if grep -Eq "claude plugin marketplace add|claude plugin install|claude plugin update|install SKIPPED" "$OUT"; then
  fail "update re-entered the plugin install/refresh path for a present plugin"
  echo "---- update output ----"; cat "$OUT"
else
  ok "update did not re-run any plugin install/refresh for present plugins"
fi
# The cheap path is intact: skills still re-copied.
assert_dir_nonempty "$HOME/.claude/skills" "skills still deployed by update"
