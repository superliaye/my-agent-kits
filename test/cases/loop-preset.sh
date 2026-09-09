#!/usr/bin/env bash
# Verify the `loop` preset deploys its survivor skills: the loop-build entry, the
# loop-plan family (loop-plan-manual/-semiauto + the grill-with-committee /
# grill-with-docs they build on) with their <!-- include: --> markers expanded,
# and the supporting skills (e2e-validate, the architecture/DDD reviews,
# diagnosing-bugs, and the visual loops).
#
# AGENT_KIT_SKIP_PLUGIN_INSTALL=1 prevents touching the live Claude Code plugin set.

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

AGENT_KIT_SKIP_PLUGIN_INSTALL=1 "$KIT_ROOT/bin/agent-kit" init \
  --preset loop --agents claude \
  || { fail "agent-kit init --preset loop exited non-zero"; exit 1; }

# loop-build is the survivor entry skill.
assert_file_exists "$HOME/.claude/skills/loop-build/SKILL.md" "loop-build SKILL.md deployed"
loop_build="$HOME/.claude/skills/loop-build/SKILL.md"
assert_content_contains "$loop_build" "completion-driven wait" "loop-build parks on its direct child"
assert_content_contains "$loop_build" "owns its descendant tree" "loop-build preserves descendant ownership"

# loop-plan family — the two plan skills + the reusable committee grill + the
# grill-with-docs it builds on. Their SKILL.md includes (research-fan-out,
# draft-to-loop-build-format, artifact-review) are strict, so a missing snippet
# would have failed the init above; here we also assert the markers expanded.
for s in loop-plan-manual loop-plan-semiauto grill-with-committee grill-with-docs; do
  assert_file_exists "$HOME/.claude/skills/$s/SKILL.md" "$s SKILL.md deployed"
done
for s in loop-plan-manual loop-plan-semiauto; do
  sm="$HOME/.claude/skills/$s/SKILL.md"
  if grep -qF "<!-- include:" "$sm"; then fail "$s: literal include marker remains after deploy"; else ok "$s: includes expanded"; fi
  assert_content_contains "$sm" "Draft \`plan.md\` + \`acceptance.md\`" "$s draft snippet expanded"
  assert_content_contains "$sm" "Artifact review (the three lenses" "$s artifact-review snippet expanded"
  assert_content_contains "$sm" "A file change alone does not" "$s keeps test criteria contract-driven"
done

# full-loop-semiauto chains plan-semiauto -> build -> retro; loop-retro is the
# session retrospective. Both ship in the preset.
assert_file_exists "$HOME/.claude/skills/full-loop-semiauto/SKILL.md" "full-loop-semiauto deployed"
assert_file_exists "$HOME/.claude/skills/loop-retro/SKILL.md" "loop-retro deployed"

# Supporting skills and Matt dependency closure the preset includes
assert_file_exists "$HOME/.claude/skills/e2e-validate/SKILL.md" "e2e-validate deployed"
assert_file_exists "$HOME/.claude/skills/improve-codebase-architecture/SKILL.md" "improve-codebase-architecture deployed"
assert_file_exists "$HOME/.claude/skills/codebase-design/SKILL.md" "codebase-design deployed"
assert_file_exists "$HOME/.claude/skills/domain-modeling/SKILL.md" "domain-modeling deployed"
assert_file_exists "$HOME/.claude/skills/grilling/SKILL.md" "grilling deployed"
assert_file_exists "$HOME/.claude/skills/improve-DDD-architecture/SKILL.md" "improve-DDD-architecture deployed"
assert_file_exists "$HOME/.claude/skills/design-critique/SKILL.md" "design-critique deployed"
assert_file_exists "$HOME/.claude/skills/product-critique/SKILL.md" "product-critique deployed"
assert_file_exists "$HOME/.claude/skills/critique-committee/SKILL.md" "critique-committee deployed"
assert_file_exists "$HOME/.claude/skills/diagnosing-bugs/SKILL.md" "diagnosing-bugs deployed"
assert_file_exists "$HOME/.claude/skills/electron-visual-loop/SKILL.md" "electron-visual-loop deployed"
assert_file_exists "$HOME/.claude/skills/web-visual-loop/SKILL.md" "web-visual-loop deployed"

for retired in diagnose to-issues caveman zoom-out; do
  if [ -d "$HOME/.claude/skills/$retired" ]; then
    fail "$retired should not deploy in the loop preset"
  else
    ok "$retired absent from the loop preset"
  fi
done

# SOURCE.md is maintainer-only upstream provenance — it must NOT deploy
# (electron-visual-loop carries one, having been copied from an upstream repo).
if [ -f "$HOME/.claude/skills/electron-visual-loop/SOURCE.md" ]; then
  fail "SOURCE.md should be excluded from deployed skill"
else
  ok "SOURCE.md excluded from deployed skill"
fi

# Core instruction lives in the global CLAUDE.md.
assert_file_exists "$HOME/.claude/CLAUDE.md" "global CLAUDE.md generated"
assert_content_contains "$HOME/.claude/CLAUDE.md" "Core Instructions" "core instruction in global CLAUDE.md"
