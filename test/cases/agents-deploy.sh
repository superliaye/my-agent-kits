#!/usr/bin/env bash
# The `agents` capability type: the loop preset deploys five code-review agents
# plus two UI critics to Claude (~/.claude/agents/<name>.md) and Codex
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
review_agents=(architecture-review rules-enforcer general-review spec-review smell-review design-critic product-critic)

AGENT_KIT_SKIP_PLUGIN_INSTALL=1 "$KIT_ROOT/bin/agent-kit" init \
  --preset loop --agents claude,codex \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Claude: each agent lands as ~/.claude/agents/<name>.md
for a in "${review_agents[@]}"; do
  assert_file_exists "$HOME/.claude/agents/$a.md" "Claude agent $a deployed"
done
assert_content_contains "$HOME/.claude/agents/architecture-review.md" "name: architecture-review" "Claude agent keeps frontmatter"

# The review-finding-contract snippet is expanded (not left as a literal marker).
af="$HOME/.claude/agents/architecture-review.md"
assert_content_contains "$af" "Precision over recall" "shared finding-contract snippet expanded into agent"
if grep -qF "<!-- include:" "$af"; then fail "literal include marker remains in deployed agent"; else ok "no literal include marker in deployed agent"; fi

# Codex: each agent is translated to ~/.codex/agents/<name>.toml
for a in "${review_agents[@]}"; do
  assert_file_exists "$HOME/.codex/agents/$a.toml" "Codex agent $a deployed (.toml)"
done
tf="$HOME/.codex/agents/architecture-review.toml"
assert_content_contains "$tf" "developer_instructions = '''" "Codex agent has developer_instructions block"
assert_content_contains "$tf" "description =" "Codex agent has description field"
assert_content_contains "$tf" "Precision over recall" "snippet expanded in Codex agent body"

# The @loop agents deploy the same way (Claude .md + Codex .toml).
for a in loop-build-agent loop-build-acceptance loop-retro-agent; do
  assert_file_exists "$HOME/.claude/agents/$a.md" "Claude agent $a deployed"
  assert_file_exists "$HOME/.codex/agents/$a.toml" "Codex agent $a deployed (.toml)"
done

# Build acceptance is bound to the Git-visible change without rereading every
# unchanged tracked file, and verification remains owned by the contract.
for host in "$HOME/.claude/agents" "$HOME/.codex/agents"; do
  suffix="md"; [ "$host" = "$HOME/.codex/agents" ] && suffix="toml"
  build="$host/loop-build-agent.$suffix"
  acceptance="$host/loop-build-acceptance.$suffix"
  spec_review="$host/spec-review.$suffix"
  assert_content_contains "$build" "Git-visible source-state attestation" "build agent carries lightweight source-state contract ($suffix)"
  assert_content_contains "$acceptance" "Git-visible source-state attestation" "acceptance agent carries lightweight source-state contract ($suffix)"
  assert_content_contains "$build" "acceptance leaf owns every acceptance signal" "build agent delegates contract verification ($suffix)"
  assert_content_contains "$acceptance" "File changes add no verification scope" "acceptance stays contract-driven ($suffix)"
  assert_content_contains "$build" "implementation hypothesis" "build agent may refine plan mechanisms ($suffix)"
  assert_content_contains "$build" "contract-defect" "build agent separates contract failures from code failures ($suffix)"
  assert_content_contains "$build" "ACCEPTANCE CONTRACT ID" "build agent binds exact acceptance bytes ($suffix)"
  assert_content_contains "$acceptance" "equivalent deterministic signal" "acceptance may repair an evidence recipe ($suffix)"
  assert_content_contains "$acceptance" "contract-defect" "acceptance reports unfixable contract failures ($suffix)"
  assert_content_contains "$acceptance" "EXPECTED ACCEPTANCE CONTRACT ID" "acceptance verifies exact contract bytes ($suffix)"
  assert_content_contains "$acceptance" "contract ID again after all checks" "acceptance rejects a contract that moves during verification ($suffix)"
  assert_content_contains "$build" "recompute the acceptance contract ID" "build rejects a contract that moves before return ($suffix)"
  assert_content_contains "$spec_review" "Implementation hypotheses (non-binding)" "spec review ignores adaptable mechanisms ($suffix)"
  assert_content_contains "$build" "longest supported wait interval" "build agent waits efficiently for long commands ($suffix)"
  assert_content_contains "$acceptance" "longest supported wait interval" "acceptance agent waits efficiently for long commands ($suffix)"
  if grep -qF "['ls-tree', '-r', '--name-only', '-z', 'HEAD']" "$build" "$acceptance"; then
    fail "HEAD-tree byte scanner remains in deployed loop agents ($suffix)"
  else
    ok "HEAD-tree byte scanner absent from deployed loop agents ($suffix)"
  fi
done

# The committee skill ships as a normal skill.
assert_file_exists "$HOME/.claude/skills/loop-review-committee/SKILL.md" "loop-review-committee skill deployed"

# Negative: agents are NOT also deployed as skills.
for a in architecture-review rules-enforcer general-review spec-review smell-review; do
  if [ -e "$HOME/.claude/skills/$a" ]; then
    fail "agent $a wrongly deployed as a skill"
  else
    ok "agent $a correctly NOT a skill"
  fi
done
