#!/usr/bin/env bash
# Opt-in primitive: electron-visual-loop is NOT in any preset by default.
# Verify it deploys when added to a preset's primitives.skills list at init time.
# Pattern: temporarily rewrite `none.yaml` with the skill added, init, restore.
# (Avoids the `node -e require(yaml)` Windows path-translation issue that hits
# update-adopt-defaults.sh.)

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

ORIG_PRESET="$(cat "$KIT_ROOT/presets/none.yaml")"
WORK="$(mktemp -d)"
cleanup() {
  printf '%s' "$ORIG_PRESET" > "$KIT_ROOT/presets/none.yaml"
  rm -rf "$WORK"
}
trap cleanup EXIT

cat > "$KIT_ROOT/presets/none.yaml" <<'EOF'
name: none
description: Empty starting point — pick everything in the customize step
default_agents: [claude]

primitives:
  instructions: []
  skills:
    - electron-visual-loop
  plugins: []
  mcp: []
  hooks: []
  bundles: []

apm_dependencies: []
EOF

cd "$WORK"
git init -q .

"$KIT_ROOT/bin/agent-kit" init --preset none --agents claude --scope repo \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Positive: skill folder and SKILL.md land in consumer repo
assert_dir_nonempty "$WORK/.claude/skills/electron-visual-loop" "electron-visual-loop folder deployed"
assert_file_exists "$WORK/.claude/skills/electron-visual-loop/SKILL.md" "electron-visual-loop SKILL.md deployed"
assert_content_contains "$WORK/.claude/skills/electron-visual-loop/SKILL.md" "agent-browser" "skill body mentions agent-browser CLI"
assert_content_contains "$WORK/.claude/skills/electron-visual-loop/SKILL.md" "remote-debugging-port" "skill body documents CDP flag"

# State recorded
assert_content_contains "$WORK/.agent-kit.yaml" "electron-visual-loop" "skill recorded in state file"
