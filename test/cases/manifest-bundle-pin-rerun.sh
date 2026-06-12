#!/usr/bin/env bash
# Pin-mismatch is the other half of the bundle-pin contract: when the manifest's
# recorded pin differs from the kit's pin (a maintainer bumped pinned_commit /
# installer.package), `update` must NOT skip — it re-runs the installer to pick
# up the new pin. Complements manifest-bundle-pin-skip.sh (the match case).
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

export AGENT_KIT_SKIP_PLUGIN_INSTALL=1 AGENT_KIT_SKIP_BUNDLE_INSTALL=1

"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents claude --bundles gstack \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Simulate a maintainer pin bump: rewrite the manifest's recorded gstack pin to a
# stale value that no longer matches the kit's pinned_commit.
MANIFEST="$HOME/.agent-kit/manifest.json"
node -e '
  const fs=require("fs");
  const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
  for (const b of m.bundles) if (b.name==="gstack") b.pin="0000000000000000000000000000000000000000";
  fs.writeFileSync(process.argv[1], JSON.stringify(m,null,2));
' "$MANIFEST"

UPD_OUT="$(mktemp)"
"$KIT_ROOT/bin/agent-kit" update --current > "$UPD_OUT" 2>&1 \
  || { fail "agent-kit update exited non-zero"; cat "$UPD_OUT"; exit 1; }

# Stale pin != kit pin → the pin-skip branch must NOT fire.
if grep -q "skipping installer" "$UPD_OUT"; then
  fail "stale pin must NOT skip the installer"
else
  ok "pin mismatch took the installer path (no skip)"
fi
# Installer path reached (faked by AGENT_KIT_SKIP_BUNDLE_INSTALL=1).
assert_content_contains "$UPD_OUT" "install SKIPPED (AGENT_KIT_SKIP_BUNDLE_INSTALL=1)" "installer path entered on pin mismatch"
# Manifest pin refreshed to the kit's current pin (stale value overwritten).
if grep -q "0000000000000000000000000000000000000000" "$MANIFEST"; then
  fail "update must refresh the manifest pin to the kit's current pin"
else
  ok "manifest pin refreshed after re-run"
fi
