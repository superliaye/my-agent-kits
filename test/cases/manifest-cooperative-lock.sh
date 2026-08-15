#!/usr/bin/env bash
# The shared manifest lock serializes read-modify-write and recovers after an
# owner process dies without releasing it.
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
mkdir -p "$HOME/.agent-kit"

node -e '
const fs = require("node:fs");
const path = require("node:path");
const manifest = { kitVersion: "", agents: [], skills: [{ name: "before" }], agentDefs: [], instructions: [], plugins: [], bundles: [] };
fs.writeFileSync(path.join(process.env.HOME, ".agent-kit", "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
'

AGENT_READY="$WORK/agent-kit.ready"
AGENT_RELEASE="$WORK/agent-kit.release"
HIVE_READY="$WORK/hive.ready"
node "$KIT_ROOT/test/lib/manifest-lock-worker.mjs" agent-kit "$AGENT_READY" "$AGENT_RELEASE" &
AGENT_PID=$!
for _ in $(seq 1 200); do [ -f "$AGENT_READY" ] && break; sleep 0.01; done
if [ ! -f "$AGENT_READY" ]; then
  fail "agent-kit writer did not acquire the manifest lock"
  wait "$AGENT_PID" 2>/dev/null || true
  exit 1
fi
node "$KIT_ROOT/test/lib/manifest-lock-worker.mjs" hive "$HIVE_READY" &
HIVE_PID=$!
sleep 0.1
if [ -f "$HIVE_READY" ]; then
  fail "second writer entered while agent-kit held the manifest lock"
else
  ok "second writer waits for the manifest lock"
fi
touch "$AGENT_RELEASE"
wait "$AGENT_PID" || fail "agent-kit writer failed"
wait "$HIVE_PID" || fail "Hive writer failed"
assert_content_contains "$HOME/.agent-kit/manifest.json" '"agent-kit"' "agent-kit RMW survives"
assert_content_contains "$HOME/.agent-kit/manifest.json" '"hive"' "Hive RMW survives"

MANIFEST_MODULE="$KIT_ROOT/lib/manifest.js" node --input-type=module -e '
import { pathToFileURL } from "node:url";
const { commitManifest, readManifest, writeManifest } = await import(pathToFileURL(process.env.MANIFEST_MODULE));
const base = readManifest();
writeManifest({ ...base, skills: [...base.skills, { name: "hive-late" }] });
await commitManifest(base, {
  ...base,
  skills: [...base.skills.filter((entry) => entry.name !== "before"), { name: "agent-commit" }],
});
'
assert_content_contains "$HOME/.agent-kit/manifest.json" '"agent-commit"' "agent-kit commit lands"
assert_content_contains "$HOME/.agent-kit/manifest.json" '"hive-late"' "concurrent Hive addition survives agent-kit commit"
if grep -q -F '"before"' "$HOME/.agent-kit/manifest.json"; then
  fail "agent-kit deletion was lost during the merged commit"
else
  ok "agent-kit deletion survives the merged commit"
fi

CRASH_READY="$WORK/crash.ready"
node "$KIT_ROOT/test/lib/manifest-lock-worker.mjs" crash "$CRASH_READY" &
CRASH_PID=$!
for _ in $(seq 1 200); do [ -f "$CRASH_READY" ] && break; sleep 0.01; done
if [ ! -f "$CRASH_READY" ]; then
  fail "crash fixture did not acquire the manifest lock"
  wait "$CRASH_PID" 2>/dev/null || true
  exit 1
fi
kill -9 "$CRASH_PID"
wait "$CRASH_PID" 2>/dev/null || true

RECOVERY_READY="$WORK/recovery.ready"
if node "$KIT_ROOT/test/lib/manifest-lock-worker.mjs" recovered "$RECOVERY_READY"; then
  ok "a crashed owner leaves no permanent manifest block"
else
  fail "manifest lock did not recover after owner crash"
fi
assert_content_contains "$HOME/.agent-kit/manifest.json" '"recovered"' "recovered writer commits"

if [ -e "$HOME/.agent-kit/manifest.json.lock" ]; then
  fail "manifest lock artifact remains after release"
else
  ok "manifest lock artifact is released"
fi
