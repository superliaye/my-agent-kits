#!/usr/bin/env bash
# The kit ships no bundles or plugins, but deploy, update, and verify still
# support both kinds. A case that exercises them runs a copy of the kit with
# fixture capabilities: lib/ resolves the kit root from its own location, so the
# copy deploys its own capabilities/ and the real kit stays untouched.

FIXTURE_SETUP_PIN="1111111111111111111111111111111111111111"

# make_fixture_kit <dir>: copy the kit into <dir> and add the fixture-setup
# bundle (setup-script), the fixture-npx bundle (npx-skills, list-valued
# verify_paths), and the fixture-plugin plugin pointer.
make_fixture_kit() {
  local dest="$1"
  mkdir -p "$dest"
  cp -R "$KIT_ROOT/bin" "$KIT_ROOT/lib" "$KIT_ROOT/presets" "$KIT_ROOT/capabilities" "$KIT_ROOT/package.json" "$dest/"
  ln -s "$KIT_ROOT/node_modules" "$dest/node_modules"
  mkdir -p "$dest/capabilities/bundles" "$dest/capabilities/plugins"

  cat > "$dest/capabilities/bundles/fixture-setup.bundle.md" <<EOF
---
description: Test fixture for the setup-script bundle kind.
added_in: 0.0.0
source: https://github.com/example/fixture-setup.git
pinned_commit: "$FIXTURE_SETUP_PIN"
installer:
  command: ./setup
  host_flag_map:
    claude: ["--host", "claude"]
    codex: ["--host", "codex"]
requires:
  - git
verify_paths:
  claude: "~/.claude/skills/fixture-setup"
  codex: "~/.agents/skills/fixture-setup"
---
EOF

  cat > "$dest/capabilities/bundles/fixture-npx.bundle.md" <<'EOF'
---
description: Test fixture for the npx-skills bundle kind.
added_in: 0.0.0
installer:
  kind: npx-skills
  package: https://github.com/example/fixture-npx/tree/2222222222222222222222222222222222222222
  skills:
    - fixture-npx
requires:
  - node
  - npx
verify_paths:
  claude:
    - "~/.claude/skills/fixture-npx"
  codex:
    - "~/.agents/skills/fixture-npx"
---
EOF

  cat > "$dest/capabilities/plugins/fixture-plugin.plugin.md" <<'EOF'
---
description: Test fixture for the plugin kind.
added_in: 0.0.0
marketplace_source: example/fixture-marketplace
marketplace_name: fixture-marketplace
plugin_name: fixture-plugin
---
EOF
}
