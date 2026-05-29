#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

# Same skip-install pattern as gstack-bundle.sh: AGENT_KIT_SKIP_BUNDLE_INSTALL=1
# records the bundle in state as if installed but skips the real
# `npx skills add` (which would fetch hyperframes' skill bundle from npm).
# This validates the kit-side scaffolding only: bundle metadata loads, the
# productivity preset's bundle list is honored, npx-skills kind is dispatched.
export AGENT_KIT_SKIP_BUNDLE_INSTALL=1

"$KIT_ROOT/bin/agent-kit" init --preset productivity --agents claude --scope repo --bundles hyperframes \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Positive: productivity preset's content lands.
assert_file_exists "$WORK/CLAUDE.md" "CLAUDE.md (thin @AGENTS.md import)"
assert_content_contains "$WORK/CLAUDE.md" "@AGENTS.md" "CLAUDE.md imports canonical AGENTS.md"
assert_content_contains "$WORK/AGENTS.md" "Core Instructions" "core instruction in canonical AGENTS.md"
assert_dir_nonempty "$WORK/.claude/skills" "skills deployed to .claude/skills"
assert_file_exists "$WORK/.claude/skills/grill-me/SKILL.md" "productivity skill (grill-me) deployed"

# Bundle-specific assertions
assert_file_exists "$WORK/.agent-kit.yaml" "state file"
assert_content_contains "$WORK/.agent-kit.yaml" "preset: productivity" "preset recorded"
# Needle indented to avoid grep parsing the leading dash as a flag.
assert_content_contains "$WORK/.agent-kit.yaml" "    - hyperframes" "bundle recorded in state"
assert_content_contains "$WORK/.agent-kit.yaml" "bundle_commits:" "bundle_commits key present"
# npx-skills bundles record the package spec (not a git SHA) in bundle_commits.
assert_content_contains "$WORK/.agent-kit.yaml" "hyperframes: heygen-com/hyperframes" "bundle pinned package recorded"

# Negative: APM artifacts should NOT exist
if [ -f "$WORK/apm.yml" ]; then fail "apm.yml should not be written"; else ok "no apm.yml created"; fi
if [ -d "$WORK/apm_modules" ]; then fail "apm_modules/ should not be created"; else ok "no apm_modules/ created"; fi

# Negative: npx-skills bundles install globally, not into the consumer repo.
if [ -d "$WORK/.claude/skills/hyperframes" ]; then
  fail "hyperframes should install globally, not into the consumer repo at .claude/skills/hyperframes/"
else
  ok "no hyperframes/ directory leaked into consumer repo"
fi
