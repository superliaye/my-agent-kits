#!/usr/bin/env bash
# agent-kit installs no plugins or bundles, but Hive records its own installs in
# the shared ~/.agent-kit/manifest.json. init and update must keep those plugins
# and bundles entries as they find them.
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

MANIFEST="$HOME/.agent-kit/manifest.json"
"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents codex \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# What Hive records after it installs the ye plugin and a bundle.
node -e '
const fs = require("fs");
const m = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
m.plugins = [{ name: "ye" }];
m.bundles = [{ name: "hive-bundle", pin: null }];
fs.writeFileSync(process.argv[1], JSON.stringify(m, null, 2) + "\n");
' "$MANIFEST"

"$KIT_ROOT/bin/agent-kit" update --current \
  || { fail "agent-kit update exited non-zero"; exit 1; }
"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents codex \
  || { fail "second agent-kit init exited non-zero"; exit 1; }

if node -e '
const m = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
process.exit(same(m.plugins, [{ name: "ye" }]) && same(m.bundles, [{ name: "hive-bundle", pin: null }]) ? 0 : 1);
' "$MANIFEST"; then
  ok "update and init keep the plugins and bundles entries Hive recorded"
else
  fail "manifest lost Hive's entries: $(cat "$MANIFEST")"
fi
