#!/usr/bin/env bash
# Opt-in capability: grill-to-design-doc ships only via experimenting-engineering.
# That preset extends engineering AND pulls the superpowers plugin (a network
# install), so we deploy onto the plugin-free engineering preset and opt the skill
# in by flag. Asserts the skill folder, its companion template, and its composed
# /grill-with-docs dependency all co-deploy.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

# Isolate BOTH HOME and USERPROFILE so the global writes land in a throwaway dir.
TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT

cd "$WORK"
git init -q .

"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents claude --capabilities '+grill-to-design-doc' \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Skill folder + the companion template its SKILL.md links to must deploy together.
assert_file_exists "$HOME/.claude/skills/grill-to-design-doc/SKILL.md" "grill-to-design-doc SKILL.md deployed"
assert_file_exists "$HOME/.claude/skills/grill-to-design-doc/DESIGN-DOC-FORMAT.md" "grill-to-design-doc companion (DESIGN-DOC-FORMAT.md) deployed"

# Composed dependency must co-deploy. grill-to-design-doc invokes /grill-with-docs
# but declares no manifest dependency — co-presence rides on the preset chain
# (experimenting-engineering extends engineering, which carries grill-with-docs).
# This assertion is the guard: if grill-with-docs were ever dropped from that chain,
# the composition would silently break and this would fail.
assert_file_exists "$HOME/.claude/skills/grill-with-docs/SKILL.md" "composed /grill-with-docs dependency co-deployed"

# SKILL.md body references the capability it composes by invocable name.
assert_content_contains "$HOME/.claude/skills/grill-to-design-doc/SKILL.md" "grill-with-docs" "SKILL body composes grill-with-docs"
