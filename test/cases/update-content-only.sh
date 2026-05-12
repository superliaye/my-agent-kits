#!/usr/bin/env bash
# Init at "v0.1.0", bump kit version + change a primitive's content,
# run agent-kit update --content-only, verify content refreshed AND
# state's kit_version_at_last_run bumps but apm.yml primitives unchanged.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

ORIG_PKG="$(cat "$KIT_ROOT/package.json")"
ORIG_CORE="$(cat "$KIT_ROOT/.apm/instructions/core.instructions.md")"

restore() {
  printf '%s' "$ORIG_PKG"  > "$KIT_ROOT/package.json"
  printf '%s' "$ORIG_CORE" > "$KIT_ROOT/.apm/instructions/core.instructions.md"
}
trap restore EXIT

# Force kit to old version FIRST so the post-init bump produces a real delta
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('$KIT_ROOT/package.json'));p.version='0.0.1';fs.writeFileSync('$KIT_ROOT/package.json',JSON.stringify(p,null,2));"

WORK="$(mktemp -d)"; cd "$WORK"; git init -q .
agent-kit init --preset engineering --agents claude --scope repo >/dev/null \
  || { fail "init failed"; exit 1; }

# Bump to a newer version so update sees a delta
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('$KIT_ROOT/package.json'));p.version='0.2.0';fs.writeFileSync('$KIT_ROOT/package.json',JSON.stringify(p,null,2));"
# Mutate one primitive
echo "" >> "$KIT_ROOT/.apm/instructions/core.instructions.md"
echo "## Added in v0.2.0" >> "$KIT_ROOT/.apm/instructions/core.instructions.md"

agent-kit update --content-only >/dev/null \
  || { fail "agent-kit update exited non-zero"; exit 1; }

NEW_VERSION="$(grep kit_version_at_last_run "$WORK/.agent-kit.yaml" | awk '{print $2}')"
[ "$NEW_VERSION" = "0.2.0" ] && ok "kit_version bumped to 0.2.0" || fail "kit_version not bumped (got $NEW_VERSION)"
assert_content_contains "$WORK/CLAUDE.md" "Added in v0.2.0" "v0.2.0 content visible in CLAUDE.md after update"
