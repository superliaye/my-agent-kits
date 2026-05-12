#!/usr/bin/env bash
# Init with `minimal` preset (just core).
# Bump kit version, add new primitive (react.instructions.md) AND extend
# minimal preset to include it. Run update --adopt-preset-defaults.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

ORIG_PKG="$(cat "$KIT_ROOT/package.json")"
ORIG_PRESET="$(cat "$KIT_ROOT/presets/minimal.yaml")"

cleanup() {
  printf '%s' "$ORIG_PKG"    > "$KIT_ROOT/package.json"
  printf '%s' "$ORIG_PRESET" > "$KIT_ROOT/presets/minimal.yaml"
  rm -f "$KIT_ROOT/.apm/instructions/react.instructions.md"
}
trap cleanup EXIT

# Force kit to old version FIRST so post-init bump produces a real delta
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('$KIT_ROOT/package.json'));p.version='0.0.1';fs.writeFileSync('$KIT_ROOT/package.json',JSON.stringify(p,null,2));"

WORK="$(mktemp -d)"; cd "$WORK"; git init -q .
agent-kit init --preset minimal --agents claude --scope repo >/dev/null \
  || { fail "init failed"; exit 1; }

# Bump to a newer version so update sees the new react primitive as new
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('$KIT_ROOT/package.json'));p.version='0.2.0';fs.writeFileSync('$KIT_ROOT/package.json',JSON.stringify(p,null,2));"

# Add a new react primitive
cat > "$KIT_ROOT/.apm/instructions/react.instructions.md" <<'EOF'
---
description: React conventions (test fixture)
applyTo: "**/*.{tsx,jsx}"
added_in: 0.2.0
---

Use functional components.
EOF

# Add 'react' to minimal preset
node -e "
const fs=require('fs'); const yaml=require('$KIT_ROOT/node_modules/yaml');
const p=yaml.parse(fs.readFileSync('$KIT_ROOT/presets/minimal.yaml','utf8'));
p.primitives.instructions.push('react');
fs.writeFileSync('$KIT_ROOT/presets/minimal.yaml', yaml.stringify(p));
"

agent-kit update --adopt-preset-defaults >/dev/null \
  || { fail "agent-kit update exited non-zero"; exit 1; }

assert_content_contains "$WORK/.agent-kit.yaml" "react" "react primitive in state"
assert_content_contains "$WORK/CLAUDE.md" "Use functional components" "react rule body merged into CLAUDE.md"
