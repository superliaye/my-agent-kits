#!/usr/bin/env bash
# `update` replays the MANIFEST selection, not the wizard defaults. A user who
# init'd a narrow preset and later runs `update` must keep that narrow selection
# — not get silently reverted to DEFAULT_SELECTED_PRESETS.
#
# Discriminator: the `loop-build` skill ships in the loop preset
# (one of the pre-checked defaults) but NOT in `engineering`. If update replayed
# defaults it would deploy loop-build; replaying the engineering manifest
# must not.
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

export AGENT_KIT_SKIP_PLUGIN_INSTALL=1 AGENT_KIT_SKIP_BUNDLE_INSTALL=1

# Seed a NARROW selection: engineering only.
"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents codex \
  || { fail "agent-kit init exited non-zero"; exit 1; }
assert_file_exists "$HOME/.agents/skills/my-commit/SKILL.md" "engineering skill present after init"
if [ -d "$HOME/.agents/skills/loop-build" ]; then
  fail "init engineering must not deploy loop-build"
else
  ok "loop-build absent after engineering init (baseline)"
fi

# --current replays the manifest non-interactively (no selection prompts).
"$KIT_ROOT/bin/agent-kit" update --current \
  || { fail "agent-kit update exited non-zero"; exit 1; }

# Engineering selection preserved...
assert_file_exists "$HOME/.agents/skills/my-commit/SKILL.md" "engineering skill preserved by update"
# ...and the defaults were NOT pulled in.
if [ -d "$HOME/.agents/skills/loop-build" ]; then
  fail "update reverted to defaults (loop-build appeared)"
else
  ok "update replayed manifest, not defaults (loop-build still absent)"
fi

# Manifest rewritten with the same selection + a kitVersion.
assert_content_contains "$HOME/.agent-kit/manifest.json" "my-commit" "manifest still records engineering selection after update"
assert_content_contains "$HOME/.agent-kit/manifest.json" "kitVersion" "manifest carries kitVersion after update"
