#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

# v0.8: --preset accepts a comma-separated list. The resulting primitive set
# is the union of all named presets, deduped per type. State persists the
# joined name (e.g. "engineering+productivity") so `agent-kit update` can
# split back to load each preset.
export AGENT_KIT_SKIP_BUNDLE_INSTALL=1

"$KIT_ROOT/bin/agent-kit" init --preset engineering,productivity --agents claude --scope repo --bundles hyperframes \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Both presets pull in `core` instruction; verify it lands exactly once (no
# duplicated body in the canonical AGENTS.md from naive concat).
core_count=$(grep -c "^# Core Instructions$" "$WORK/AGENTS.md" 2>/dev/null || echo 0)
if [ "$core_count" = "1" ]; then
  ok "core instruction deduped across presets (one occurrence in AGENTS.md)"
else
  fail "core instruction not deduped (found $core_count occurrences of '# Core Instructions' header in AGENTS.md)"
fi

# CLAUDE.md is the thin import onto the canonical AGENTS.md.
assert_content_contains "$WORK/CLAUDE.md" "@AGENTS.md" "CLAUDE.md imports canonical AGENTS.md"

# Engineering-only contribution still present (typescript is in engineering
# but not productivity — confirms the union, not just the intersection).
assert_content_contains "$WORK/AGENTS.md" "TypeScript Rules" "engineering's typescript instruction in AGENTS.md (union, not intersection)"

# Engineering-only skill present
assert_file_exists "$WORK/.claude/skills/my-commit/SKILL.md" "engineering skill (my-commit) deployed via multi-preset"

# Productivity-only bundle merged into the working set
assert_content_contains "$WORK/.agent-kit.yaml" "    - hyperframes" "productivity's hyperframes bundle recorded in state (union)"

# State persists the joined name
assert_file_exists "$WORK/.agent-kit.yaml" "state file"
assert_content_contains "$WORK/.agent-kit.yaml" "preset: engineering+productivity" "joined preset name recorded in state"

# Sanity: re-running `agent-kit update --content-only` against a multi-preset
# state file should NOT fail (splitPresetNames + loadPresets must round-trip).
"$KIT_ROOT/bin/agent-kit" update "$WORK" --content-only \
  && ok "agent-kit update round-trips multi-preset state" \
  || fail "agent-kit update failed on multi-preset state"
