#!/usr/bin/env bash
# Bundles carry a pin (commit-sha for setup-script, package-spec for npx-skills).
# The pin is the skip signal: on a re-apply where the manifest pin already
# matches the kit pin, the expensive installer is skipped entirely. This is the
# fix for update's old unconditional re-run of runBundleInstaller.
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

# Skip the real clone/setup; we assert pin recording + skip-on-match, not the
# heavy install. The pin-skip decision is evaluated regardless of this flag.
export AGENT_KIT_SKIP_PLUGIN_INSTALL=1 AGENT_KIT_SKIP_BUNDLE_INSTALL=1
GSTACK_PIN="dc6252d1df7f1f650ea6e9b2bba7d08fab5de902"

# First apply records the pin in the manifest; nothing to skip yet.
INIT_OUT="$(mktemp)"
"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents claude --bundles gstack > "$INIT_OUT" 2>&1 \
  || { fail "agent-kit init exited non-zero"; cat "$INIT_OUT"; exit 1; }

assert_content_contains "$HOME/.agent-kit/manifest.json" "gstack" "manifest records the bundle"
assert_content_contains "$HOME/.agent-kit/manifest.json" "$GSTACK_PIN" "manifest records the bundle pin"
if grep -q "skipping installer" "$INIT_OUT"; then
  fail "first apply must not report a pin-skip (nothing installed yet)"
else
  ok "first apply ran the installer path (no skip)"
fi

# Re-apply via update: manifest pin == kit pin → installer skipped.
UPD_OUT="$(mktemp)"
"$KIT_ROOT/bin/agent-kit" update --current > "$UPD_OUT" 2>&1 \
  || { fail "agent-kit update exited non-zero"; cat "$UPD_OUT"; exit 1; }

assert_content_contains "$UPD_OUT" "skipping installer" "update skips the bundle installer when pin matches"
assert_content_contains "$HOME/.agent-kit/manifest.json" "$GSTACK_PIN" "manifest still carries the pin after update"
