#!/usr/bin/env bash
# v0.3: verify that a Codex-only init with the full `engineering` preset
# (which has instructions + skills) correctly:
# - delivers what Codex actually reads (AGENTS.md, .agents/skills/)
# - does NOT leak Claude-only artifacts (.claude/ dir absent)
# - does NOT install Claude Code plugins (none in engineering preset, but
#   the negative assertion stays as a defense for future preset changes)
# - emits Codex sidecars for skills (manual-only policy)
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

# Isolation: the matrix runs cases in one container, sharing $HOME. A prior
# Claude case may have populated ~/.claude/plugins/. Wipe that state for this
# case so the "superpowers NOT installed" negative assertion has a clean slate.
rm -rf "$HOME/.claude/plugins" "$HOME/.apm" 2>/dev/null

WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents codex --scope repo \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Positive — what SHOULD reach Codex
assert_file_exists "$WORK/AGENTS.md" "AGENTS.md present"
assert_content_contains "$WORK/AGENTS.md" "Think Before Coding" "karpathy instruction in concatenated AGENTS.md"
assert_content_contains "$WORK/AGENTS.md" "Core Instructions" "core instruction in concatenated AGENTS.md"
assert_dir_nonempty "$WORK/.agents/skills" "skills landed at cross-client location"
assert_file_exists "$WORK/.agents/skills/my-commit/SKILL.md" "my-commit skill deployed"
assert_file_exists "$WORK/.agents/skills/my-commit/agents/openai.yaml" "Codex sidecar emitted"

# Negative — Claude-only artifacts should NOT leak
if [ -d "$WORK/.claude" ]; then
  fail ".claude/ dir leaked into Codex-only repo"
else
  ok "no .claude/ dir leaked"
fi

# Negative — superpowers plugin should NOT be installed when claude not selected
if [ -f "$HOME/.claude/plugins/installed_plugins.json" ]; then
  if grep -q "superpowers" "$HOME/.claude/plugins/installed_plugins.json"; then
    fail "superpowers plugin was installed despite codex-only agent selection"
  else
    ok "superpowers NOT installed (claude not in selected_agents)"
  fi
else
  ok "no plugins state file created for codex-only run"
fi

# State file: plugins list should be empty for codex-only (per the agent-kit guard)
assert_content_contains "$WORK/.agent-kit.yaml" "plugins: []" "state recorded plugins as empty for codex-only"
