#!/usr/bin/env bash
# "Removed-after-X" semantic without a `deleted_in` field: if the manifest names
# a skill the current kit no longer ships, `update` deletes its deployed dir.
# The manifest is the deletion ledger — the gone-from-kit skill has no file to
# carry a frontmatter flag, so the record must outlive it.
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

export AGENT_KIT_SKIP_PLUGIN_INSTALL=1 AGENT_KIT_SKIP_BUNDLE_INSTALL=1

# Seed a real manifest + deploy.
"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents codex \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Simulate a capability that was shipped at install time but removed from a later
# kit: add a "ghost-skill" to the manifest and place a deployed dir for it
# (agent-kit-owned, since it's in the manifest). The current kit does not ship
# ghost-skill, so update must delete it.
MANIFEST="$HOME/.agent-kit/manifest.json"
node -e '
  const fs=require("fs");
  const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
  m.skills.push({name:"ghost-skill"});
  fs.writeFileSync(process.argv[1], JSON.stringify(m,null,2));
' "$MANIFEST"
mkdir -p "$HOME/.agents/skills/ghost-skill"
echo "---" > "$HOME/.agents/skills/ghost-skill/SKILL.md"
assert_dir_exists "$HOME/.agents/skills/ghost-skill" "ghost-skill deployed (setup)"

"$KIT_ROOT/bin/agent-kit" update --current \
  || { fail "agent-kit update exited non-zero"; exit 1; }

# Removed-from-kit, manifest-owned → deleted.
if [ -d "$HOME/.agents/skills/ghost-skill" ]; then
  fail "update must delete a manifest-owned skill the kit no longer ships"
else
  ok "update deleted the removed-from-kit skill"
fi
# The rest of the selection survives.
assert_file_exists "$HOME/.agents/skills/my-commit/SKILL.md" "still-shipped skill preserved by update"
# Manifest no longer carries the dropped entry.
if grep -q "ghost-skill" "$MANIFEST"; then
  fail "rewritten manifest must drop the removed entry"
else
  ok "rewritten manifest dropped the removed entry"
fi
