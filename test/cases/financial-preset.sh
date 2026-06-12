#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

# Global-only: init --preset financial deploys the serenity skill to ~/.claude/skills/.
# Isolate BOTH HOME and USERPROFILE (node's os.homedir() reads USERPROFILE on Windows)
# so the global writes land in a throwaway dir, never the dev's real ~/.claude.
TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

"$KIT_ROOT/bin/agent-kit" init --preset financial --agents claude \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# The serenity skill and its use-time companions must deploy to the global skills dir.
# Their presence is the proof the financial preset ran (no per-repo state file records it).
SKILL="$HOME/.claude/skills/serenity-chokepoint-market-research"
assert_file_exists "$SKILL/SKILL.md" "serenity skill deployed"
assert_file_exists "$SKILL/templates/theme_analysis.md" "serenity template companion deployed"
assert_file_exists "$SKILL/examples/example_power_transformers.md" "serenity example companion deployed"
assert_content_contains "$SKILL/SKILL.md" "chokepoint" "serenity SKILL body present"

# The _unshipped/ provenance assets must NOT deploy.
if [ -d "$SKILL/_unshipped" ]; then
  fail "_unshipped/ should be excluded from deployed skill"
else
  ok "_unshipped/ excluded from deployed skill"
fi
