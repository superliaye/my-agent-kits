#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT

MANIFEST="$HOME/.agent-kit/manifest.json"
ARTIFACT="$HOME/.agents/skills/shared/SKILL.md"
HELD="$WORK/held"
RELEASE="$WORK/release"
SECOND="$WORK/second"
mkdir -p "$(dirname "$MANIFEST")" "$(dirname "$ARTIFACT")"
printf '%s\n' '{"kitVersion":"","agents":["codex"],"skills":[{"name":"shared"}],"agentDefs":[],"instructions":[],"plugins":[],"bundles":[]}' > "$MANIFEST"
printf '%s\n' before > "$ARTIFACT"

MANIFEST_MODULE="$(node -e 'const { pathToFileURL } = require("node:url"); process.stdout.write(pathToFileURL(process.argv[1]).href)' "$KIT_ROOT/lib/manifest.js")"
export MANIFEST_MODULE ARTIFACT HELD RELEASE SECOND

node --input-type=module <<'JS' &
import { existsSync, rmSync, writeFileSync } from "node:fs";
const { buildManifest, withManifestTransaction } = await import(process.env.MANIFEST_MODULE);
await withManifestTransaction(async ({ commit }) => {
  rmSync(process.env.ARTIFACT, { force: true });
  writeFileSync(process.env.HELD, "held");
  while (!existsSync(process.env.RELEASE)) await new Promise((resolve) => setTimeout(resolve, 10));
  commit(buildManifest({ kitVersion: "", agents: ["codex"], capabilities: {} }));
});
JS
first_pid=$!

for _ in $(seq 1 200); do
  [ -f "$HELD" ] && break
  sleep 0.01
done

node --input-type=module <<'JS' &
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
const { buildManifest, withManifestTransaction } = await import(process.env.MANIFEST_MODULE);
await withManifestTransaction(({ commit }) => {
  mkdirSync(dirname(process.env.ARTIFACT), { recursive: true });
  writeFileSync(process.env.ARTIFACT, "second\n");
  commit(buildManifest({ kitVersion: "", agents: ["codex"], capabilities: { skills: ["shared"] } }));
  writeFileSync(process.env.SECOND, "done");
});
JS
second_pid=$!

sleep 0.1
if [ -e "$SECOND" ]; then
  fail "second artifact transaction must wait for the shared manifest lock"
else
  ok "second artifact transaction waits for the shared manifest lock"
fi

printf '%s\n' release > "$RELEASE"
wait "$first_pid"
wait "$second_pid"

assert_file_exists "$ARTIFACT" "serialized transaction leaves the selected artifact present"
if node -e 'const m=require(process.argv[1]); process.exit(m.skills.some((x) => x.name === "shared") ? 0 : 1)' "$MANIFEST"; then
  ok "serialized transaction leaves the selected artifact owned"
else
  fail "serialized transaction must keep artifact and manifest ownership consistent"
fi
