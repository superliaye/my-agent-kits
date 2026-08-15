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
node "$KIT_ROOT/test/lib/manifest-lock-worker.mjs" protocol-peer "$HIVE_READY" &
HIVE_PID=$!
sleep 0.1
if [ -f "$HIVE_READY" ]; then
  fail "second writer entered while agent-kit held the manifest lock"
else
  ok "second writer waits for the manifest lock"
fi
touch "$AGENT_RELEASE"
wait "$AGENT_PID" || fail "agent-kit writer failed"
wait "$HIVE_PID" || fail "protocol peer writer failed"
assert_content_contains "$HOME/.agent-kit/manifest.json" '"agent-kit"' "agent-kit RMW survives"
assert_content_contains "$HOME/.agent-kit/manifest.json" '"protocol-peer"' "protocol peer RMW survives"

BLOCKED_READY="$WORK/blocked.ready"
BLOCKED_OTHER_READY="$WORK/blocked-other.ready"
LOCK_BLOCK_MS=3500 node "$KIT_ROOT/test/lib/manifest-lock-worker.mjs" blocked-owner "$BLOCKED_READY" &
BLOCKED_PID=$!
for _ in $(seq 1 200); do [ -f "$BLOCKED_READY" ] && break; sleep 0.01; done
if [ ! -f "$BLOCKED_READY" ]; then
  fail "blocked owner did not acquire the manifest lock"
  wait "$BLOCKED_PID" 2>/dev/null || true
  exit 1
fi
node "$KIT_ROOT/test/lib/manifest-lock-worker.mjs" blocked-other "$BLOCKED_OTHER_READY" &
BLOCKED_OTHER_PID=$!
sleep 2.8
LOCK_AGE_MS=$(node -e '
const fs = require("node:fs");
const path = require("node:path");
const lock = path.join(process.env.HOME, ".agent-kit", "manifest.json.lock");
process.stdout.write(String(Math.round(Date.now() - fs.statSync(lock).mtimeMs)));
')
if [ "$LOCK_AGE_MS" -lt 1000 ]; then
  ok "keeper heartbeat continues while the owner event loop is blocked"
else
  fail "keeper heartbeat was starved by the blocked owner"
fi
if [ -f "$BLOCKED_OTHER_READY" ]; then
  fail "second writer stole a live lock while its parent event loop was blocked"
else
  ok "independent heartbeat preserves a live blocked owner's lock"
fi
wait "$BLOCKED_PID" || fail "blocked owner failed"
wait "$BLOCKED_OTHER_PID" || fail "writer waiting on blocked owner failed"

KEEPER_OWNER_READY="$WORK/keeper-owner.ready"
KEEPER_OWNER_RELEASE="$WORK/keeper-owner.release"
KEEPER_OTHER_READY="$WORK/keeper-other.ready"
node "$KIT_ROOT/test/lib/manifest-lock-worker.mjs" keeper-owner "$KEEPER_OWNER_READY" "$KEEPER_OWNER_RELEASE" &
KEEPER_OWNER_PID=$!
for _ in $(seq 1 200); do [ -f "$KEEPER_OWNER_READY" ] && break; sleep 0.01; done
if [ ! -f "$KEEPER_OWNER_READY" ]; then
  fail "keeper-crash owner did not acquire the manifest lock"
  wait "$KEEPER_OWNER_PID" 2>/dev/null || true
  exit 1
fi
KEEPER_PID=$(node -e '
const fs = require("node:fs");
const path = require("node:path");
const owner = JSON.parse(fs.readFileSync(path.join(process.env.HOME, ".agent-kit", "manifest.json.lock", "owner.json"), "utf8"));
process.stdout.write(String(owner.keeper.pid));
')
kill -9 "$KEEPER_PID"
node "$KIT_ROOT/test/lib/manifest-lock-worker.mjs" keeper-other "$KEEPER_OTHER_READY" &
KEEPER_OTHER_PID=$!
sleep 2.3
if [ -f "$KEEPER_OTHER_READY" ]; then
  fail "second writer stole the live owner's lock after its keeper crashed"
else
  ok "a live owner remains exclusive after its keeper crashes"
fi
touch "$KEEPER_OWNER_RELEASE"
wait "$KEEPER_OWNER_PID" || fail "owner did not safely release after keeper crash"
wait "$KEEPER_OTHER_PID" || fail "waiting writer failed after keeper crash recovery"

MANIFEST_MODULE="$KIT_ROOT/lib/manifest.js" node --input-type=module -e '
import { pathToFileURL } from "node:url";
const { commitManifest, readManifest } = await import(pathToFileURL(process.env.MANIFEST_MODULE));
const base = readManifest();
await commitManifest(base, { ...base, skills: [...base.skills, { name: "peer-late" }] });
await commitManifest(base, {
  ...base,
  skills: [...base.skills.filter((entry) => entry.name !== "before"), { name: "agent-commit" }],
});
'
assert_content_contains "$HOME/.agent-kit/manifest.json" '"agent-commit"' "agent-kit commit lands"
assert_content_contains "$HOME/.agent-kit/manifest.json" '"peer-late"' "concurrent peer addition survives agent-kit commit"
if grep -q -F '"before"' "$HOME/.agent-kit/manifest.json"; then
  fail "agent-kit deletion was lost during the merged commit"
else
  ok "agent-kit deletion survives the merged commit"
fi

CRASH_READY="$WORK/crash.ready"
LOCK_USE_DEFAULTS=1 node "$KIT_ROOT/test/lib/manifest-lock-worker.mjs" crash "$CRASH_READY" &
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
if timeout 6s env LOCK_USE_DEFAULTS=1 node "$KIT_ROOT/test/lib/manifest-lock-worker.mjs" recovered "$RECOVERY_READY"; then
  ok "production defaults recover a crashed owner within the acquisition timeout"
else
  fail "production defaults did not recover the crashed owner within the acquisition timeout"
fi
assert_content_contains "$HOME/.agent-kit/manifest.json" '"recovered"' "recovered writer commits"

if [ -e "$HOME/.agent-kit/manifest.json.lock" ]; then
  fail "manifest lock artifact remains after release"
else
  ok "manifest lock artifact is released"
fi

MANIFEST_MODULE="$KIT_ROOT/lib/manifest.js" node --input-type=module -e '
import { pathToFileURL } from "node:url";
const manifest = await import(pathToFileURL(process.env.MANIFEST_MODULE));
if ("writeManifest" in manifest) process.exit(1);
' && ok "manifest module exposes no unlocked write bypass" || fail "writeManifest remains an unlocked export"
