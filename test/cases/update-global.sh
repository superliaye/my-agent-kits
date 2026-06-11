#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

# Global-only: `update` is a stateless re-deploy of the kit to the global install
# (no per-repo state file to diff against). Isolate BOTH HOME and USERPROFILE
# (node's os.homedir() reads USERPROFILE on Windows) so global writes land in a
# throwaway dir, never the dev's real ~/.codex or ~/.agents.
TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"
git init -q .

# Defensive: engineering preset has plugins:[] and bundles:[] so neither install
# path fires; update's plugin refresh is additionally guarded on claudeSelected,
# and we pass --agents codex which skips it entirely.
export AGENT_KIT_SKIP_PLUGIN_INSTALL=1 AGENT_KIT_SKIP_BUNDLE_INSTALL=1

# Seed a global install, then re-deploy via update. Both flags present => update
# runs non-interactively (update.js:17) and returns verify()'s code; a clean
# re-deploy yields 0.
"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents codex \
  || { fail "agent-kit init exited non-zero"; exit 1; }
"$KIT_ROOT/bin/agent-kit" update --preset engineering --agents codex \
  || { fail "agent-kit update exited non-zero"; exit 1; }
ok "update re-deployed without prompts (exit 0)"

# Global artifacts present after update (re-deployed, not diffed away).
assert_file_exists "$HOME/.codex/AGENTS.md" "global AGENTS.md after update"
assert_content_contains "$HOME/.codex/AGENTS.md" "Core Instructions" "core instruction in global AGENTS.md after update"
assert_file_exists "$HOME/.agents/skills/my-commit/SKILL.md" "my-commit codex skill present after update"
# Sidecar regenerated — my-commit sets disable-model-invocation: true.
assert_file_exists "$HOME/.agents/skills/my-commit/agents/openai.yaml" "Codex sidecar regenerated after update"

# Stateless-contract negative: update must NOT write a per-repo state file.
if [ -f "$WORK/.agent-kit.yaml" ]; then fail "update wrote $WORK/.agent-kit.yaml (state file must not exist)"; else ok "no .agent-kit.yaml written"; fi
