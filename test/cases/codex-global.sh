#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

# Global-only: init deploys to ~/.codex/AGENTS.md + ~/.agents/skills/. Isolate
# BOTH HOME and USERPROFILE (node's os.homedir() reads USERPROFILE on Windows)
# so the global writes land in a throwaway dir, never the dev's real ~/.codex.
TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents codex \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Positive: AGENTS.md written directly to where Codex reads (no staging copy step)
assert_file_exists "$HOME/.codex/AGENTS.md" "global AGENTS.md"
assert_content_contains "$HOME/.codex/AGENTS.md" "Core Instructions" "core instruction in global AGENTS.md"

# Global Codex skills land in ~/.agents/skills/, with manual-only sidecars for
# skills whose SKILL.md sets disable-model-invocation: true (e.g. my-commit).
assert_file_exists "$HOME/.agents/skills/my-commit/SKILL.md" "my-commit codex skill deployed globally"
assert_file_exists "$HOME/.agents/skills/my-commit/agents/openai.yaml" "Codex sidecar generated globally"
assert_content_contains "$HOME/.agents/skills/my-commit/agents/openai.yaml" "allow_implicit_invocation: false" "sidecar manual-only policy"
