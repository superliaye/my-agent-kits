#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

export AGENT_KIT_SKIP_PLUGIN_INSTALL=1 AGENT_KIT_SKIP_BUNDLE_INSTALL=1

"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents codex \
  || { fail "agent-kit init exited non-zero"; exit 1; }

MANIFEST="$HOME/.agent-kit/manifest.json"
node --input-type=module - "$MANIFEST" <<'NODE'
import { readFileSync, writeFileSync } from "node:fs";
const path = process.argv[2];
const manifest = JSON.parse(readFileSync(path, "utf8"));
const legacy = new Map([
  ["diagnosing-bugs", "diagnose"],
  ["to-spec", "to-prd"],
  ["writing-for-agents", "write-a-skill"],
]);
manifest.skills = manifest.skills.map(({ name }) => ({ name: legacy.get(name) ?? name }));
manifest.skills.push({ name: "to-issues" }, { name: "caveman" }, { name: "zoom-out" });
writeFileSync(path, JSON.stringify(manifest, null, 2) + "\n");
NODE

for legacy in diagnose to-prd write-a-skill to-issues caveman zoom-out; do
  mkdir -p "$HOME/.agents/skills/$legacy"
  printf '%s\n' '---' > "$HOME/.agents/skills/$legacy/SKILL.md"
done
for successor in diagnosing-bugs to-spec writing-for-agents; do
  rm -rf "$HOME/.agents/skills/$successor"
done

"$KIT_ROOT/bin/agent-kit" update --current \
  || { fail "agent-kit update --current exited non-zero"; exit 1; }

for successor in diagnosing-bugs to-spec writing-for-agents; do
  assert_file_exists "$HOME/.agents/skills/$successor/SKILL.md" "$successor restored by migrated replay"
  assert_content_contains "$MANIFEST" "\"name\": \"$successor\"" "$successor recorded in migrated manifest"
done
for legacy in diagnose to-prd write-a-skill to-issues caveman zoom-out; do
  if [ -d "$HOME/.agents/skills/$legacy" ]; then
    fail "$legacy deployed directory remains after migration"
  else
    ok "$legacy deployed directory removed by migration"
  fi
  if grep -q "\"name\": \"$legacy\"" "$MANIFEST"; then
    fail "$legacy remains in migrated manifest"
  else
    ok "$legacy removed from migrated manifest"
  fi
done

if node --input-type=module - "$KIT_ROOT" <<'NODE'
const { migrateSelection } = await import(`${process.argv[2]}/lib/selection-migrations.js`);
const seeded = migrateSelection({
  skills: ["diagnose", "to-prd", "write-a-skill", "to-issues", "caveman", "zoom-out"],
});
const expected = ["diagnosing-bugs", "to-spec", "writing-for-agents"];
if (JSON.stringify(seeded.skills) !== JSON.stringify(expected)) process.exit(1);
NODE
then
  ok "central migration canonicalizes the interactive seed"
else
  fail "central migration canonicalizes the interactive seed"
  exit 1
fi
assert_content_contains "$KIT_ROOT/lib/update.js" "pickCapabilitiesFrom(manifestSelection)" "interactive update receives migrated manifest selection"
