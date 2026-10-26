#!/usr/bin/env bash
# Verify the review skill and manual-only policy survive deployment and update.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

TMPROOT="$(mktemp -d)"
trap 'rm -rf "$TMPROOT"' EXIT
export HOME="$TMPROOT/home" USERPROFILE="$TMPROOT/home"
mkdir -p "$HOME" "$TMPROOT/work"
cd "$TMPROOT/work"
git init -q .

"$KIT_ROOT/bin/agent-kit" init --preset productivity --agents claude,codex \
  || { fail "productivity deploy failed"; exit 1; }

for root in "$HOME/.claude/skills" "$HOME/.agents/skills"; do
  assert_file_exists "$root/project-review/SKILL.md" "review skill deployed to $root"
  assert_content_contains "$root/project-review/SKILL.md" "disable-model-invocation: true" "review skill requires manual invocation"
done
assert_content_contains "$HOME/.agents/skills/project-review/agents/openai.yaml" "allow_implicit_invocation: false" "review Codex policy disables implicit invocation"

"$KIT_ROOT/bin/agent-kit" update --current \
  || { fail "productivity update failed"; exit 1; }

for root in "$HOME/.claude/skills" "$HOME/.agents/skills"; do
  assert_file_exists "$root/project-review/SKILL.md" "review skill retained in $root"
  if cmp -s "$KIT_ROOT/capabilities/skills/@my-productivity/project-review/SKILL.md" "$root/project-review/SKILL.md"; then
    ok "review skill roundtrip preserves its complete instructions"
  else
    fail "review skill roundtrip changed its instructions"
  fi
done
assert_content_contains "$HOME/.agents/skills/project-review/agents/openai.yaml" "allow_implicit_invocation: false" "review Codex policy survives update"

[ "$FAIL" -eq 0 ]
