#!/usr/bin/env bash
# Ownership rule: in the manifest → agent-kit may manage it; on disk but NOT in
# the manifest → user-installed, hands off. `update` re-deploys/deletes only what
# the manifest records; a skill the user dropped in themselves must survive.
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

export AGENT_KIT_SKIP_PLUGIN_INSTALL=1 AGENT_KIT_SKIP_BUNDLE_INSTALL=1

"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents codex \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# A skill the user installed themselves — never recorded in agent-kit's manifest.
mkdir -p "$HOME/.agents/skills/my-own-hand-rolled-skill"
echo "mine" > "$HOME/.agents/skills/my-own-hand-rolled-skill/SKILL.md"

"$KIT_ROOT/bin/agent-kit" update --current \
  || { fail "agent-kit update exited non-zero"; exit 1; }

assert_file_exists "$HOME/.agents/skills/my-own-hand-rolled-skill/SKILL.md" "user-installed skill survives update (not manifest-owned)"
assert_content_contains "$HOME/.agents/skills/my-own-hand-rolled-skill/SKILL.md" "mine" "user-installed skill untouched by update"
