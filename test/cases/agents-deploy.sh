#!/usr/bin/env bash
# The `agents` capability type: the loop preset deploys the three @reviews
# agents to Claude (~/.claude/agents/<name>.md) and Codex
# (~/.codex/agents/<name>.toml), with the shared review-finding-contract snippet
# expanded, and NOT as skills.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"; git init -q .

AGENT_KIT_SKIP_PLUGIN_INSTALL=1 "$KIT_ROOT/bin/agent-kit" init \
  --preset loop --agents claude,codex \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Claude: each agent lands as ~/.claude/agents/<name>.md
for a in architecture-review rules-enforcer general-review; do
  assert_file_exists "$HOME/.claude/agents/$a.md" "Claude agent $a deployed"
done
assert_content_contains "$HOME/.claude/agents/architecture-review.md" "name: architecture-review" "Claude agent keeps frontmatter"

# The review-finding-contract snippet is expanded (not left as a literal marker).
af="$HOME/.claude/agents/architecture-review.md"
assert_content_contains "$af" "Precision over recall" "shared finding-contract snippet expanded into agent"
if grep -qF "<!-- include:" "$af"; then fail "literal include marker remains in deployed agent"; else ok "no literal include marker in deployed agent"; fi

# Codex: each agent is translated to ~/.codex/agents/<name>.toml
for a in architecture-review rules-enforcer general-review; do
  assert_file_exists "$HOME/.codex/agents/$a.toml" "Codex agent $a deployed (.toml)"
done
tf="$HOME/.codex/agents/architecture-review.toml"
assert_content_contains "$tf" "developer_instructions = '''" "Codex agent has developer_instructions block"
assert_content_contains "$tf" "description =" "Codex agent has description field"
assert_content_contains "$tf" "Precision over recall" "snippet expanded in Codex agent body"

# The committee skill ships as a normal skill.
assert_file_exists "$HOME/.claude/skills/loop-review-committee/SKILL.md" "loop-review-committee skill deployed"

# Negative: agents are NOT also deployed as skills.
for a in architecture-review rules-enforcer general-review; do
  if [ -e "$HOME/.claude/skills/$a" ]; then
    fail "agent $a wrongly deployed as a skill"
  else
    ok "agent $a correctly NOT a skill"
  fi
done
