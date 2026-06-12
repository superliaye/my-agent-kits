#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

# Global-only: init deploys to ~/.claude/CLAUDE.md + ~/.claude/skills/. Isolate
# BOTH HOME and USERPROFILE (node's os.homedir() reads USERPROFILE on Windows)
# so the global writes land in a throwaway dir, never the dev's real ~/.claude.
TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents claude \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Positive: what should land at user-scope locations Claude Code reads
assert_file_exists "$HOME/.claude/CLAUDE.md" "global CLAUDE.md (instructions concatenated)"
assert_content_contains "$HOME/.claude/CLAUDE.md" "Core Instructions" "core instruction in global CLAUDE.md"
assert_dir_nonempty "$HOME/.claude/skills" "global skills deployed"
assert_file_exists "$HOME/.claude/skills/my-commit/SKILL.md" "specific skill (my-commit) deployed"

# Negative: global-only deploy writes nothing extra
if [ -d "$HOME/.claude/rules" ]; then fail "~/.claude/rules/ should not be created"; else ok "no ~/.claude/rules/ created"; fi
