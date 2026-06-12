#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

"$KIT_ROOT/bin/agent-kit" init --preset financial --agents claude --scope repo \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# The serenity skill and its use-time companions must deploy.
SKILL="$WORK/.claude/skills/serenity-chokepoint-market-research"
assert_file_exists "$SKILL/SKILL.md" "serenity skill deployed"
assert_file_exists "$SKILL/templates/theme_analysis.md" "serenity template companion deployed"
assert_file_exists "$SKILL/examples/example_power_transformers.md" "serenity example companion deployed"
assert_content_contains "$SKILL/SKILL.md" "chokepoint" "serenity SKILL body present"
assert_content_contains "$WORK/.agent-kit.yaml" "preset: financial" "financial preset recorded"

# The _unshipped/ provenance assets must NOT deploy to the consumer repo.
if [ -d "$SKILL/_unshipped" ]; then
  fail "_unshipped/ should be excluded from deployed skill"
else
  ok "_unshipped/ excluded from deployed skill"
fi
