#!/usr/bin/env bash
# Init with `none` preset (empty primitives).
# Bump kit version, add new primitive (react.instructions.md) AND extend
# the `none` preset to include it. Run update --adopt-preset-defaults.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

ORIG_PKG="$(cat "$KIT_ROOT/package.json")"
ORIG_PRESET="$(cat "$KIT_ROOT/presets/none.yaml")"

cleanup() {
  printf '%s' "$ORIG_PKG"    > "$KIT_ROOT/package.json"
  printf '%s' "$ORIG_PRESET" > "$KIT_ROOT/presets/none.yaml"
  rm -f "$KIT_ROOT/.apm/instructions/react.instructions.md"
}
trap cleanup EXIT

# Force kit to old version FIRST so post-init bump produces a real delta
node "$KIT_ROOT/test/lib/set-kit-version.mjs" 0.0.1

WORK="$(mktemp -d)"; cd "$WORK"; git init -q .
"$KIT_ROOT/bin/agent-kit" init --preset none --agents claude --scope repo >/dev/null \
  || { fail "init failed"; exit 1; }

# Bump to a newer version so update sees the new react primitive as new
node "$KIT_ROOT/test/lib/set-kit-version.mjs" 0.2.0

# Add a new react primitive
cat > "$KIT_ROOT/.apm/instructions/react.instructions.md" <<'EOF'
---
description: React conventions (test fixture)
applyTo: "**/*.{tsx,jsx}"
added_in: 0.2.0
---

Use functional components.
EOF

# Add 'react' to none preset
node "$KIT_ROOT/test/lib/add-preset-primitive.mjs" none instructions react

"$KIT_ROOT/bin/agent-kit" update --adopt-preset-defaults >/dev/null \
  || { fail "agent-kit update exited non-zero"; exit 1; }

assert_content_contains "$WORK/.agent-kit.yaml" "react" "react primitive in state"
assert_content_contains "$WORK/AGENTS.md" "Use functional components" "react rule body merged into canonical AGENTS.md"
