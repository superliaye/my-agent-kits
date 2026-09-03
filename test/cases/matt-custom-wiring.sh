#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

export AGENT_KIT_SKIP_PLUGIN_INSTALL=1 AGENT_KIT_SKIP_BUNDLE_INSTALL=1

"$KIT_ROOT/bin/agent-kit" init --preset loop --agents claude,codex \
  || { fail "agent-kit init --preset loop exited non-zero"; exit 1; }

for root in "$HOME/.claude/skills" "$HOME/.agents/skills"; do
  assert_content_contains "$root/e2e-validate/SKILL.md" "/diagnosing-bugs" "e2e-validate routes to diagnosing-bugs"
  assert_content_contains "$root/grill-with-committee/SKILL.md" 'Skill tool with `grilling`' "committee grill invokes grilling"
  assert_content_contains "$root/grill-with-committee/SKILL.md" 'Skill tool with `domain-modeling`' "committee grill invokes domain-modeling"
done

assert_content_contains "$HOME/.claude/agents/architecture-review.md" "/codebase-design" "Claude architecture review uses codebase-design"
assert_content_contains "$HOME/.codex/agents/architecture-review.toml" "/codebase-design" "Codex architecture review uses codebase-design"

for deployed in \
  "$HOME/.claude/skills/loop-plan-manual/SKILL.md" \
  "$HOME/.agents/skills/loop-plan-manual/SKILL.md"; do
  assert_content_contains "$deployed" "/grill-with-docs" "loop-plan-manual retains grill-with-docs composition"
done

for deployed in \
  "$HOME/.claude/skills/e2e-validate/SKILL.md" \
  "$HOME/.agents/skills/e2e-validate/SKILL.md"; do
  if grep -qF '`/diagnose`' "$deployed"; then
    fail "legacy /diagnose invocation remains in $deployed"
  else
    ok "legacy /diagnose invocation absent from $deployed"
  fi
done
