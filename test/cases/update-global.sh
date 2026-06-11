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

# Seed a global install. Both flags present => init/update run non-interactively
# (update.js:17) and return verify()'s code; a clean deploy yields 0.
"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents codex \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Global artifacts present after the seed (baseline).
assert_file_exists "$HOME/.codex/AGENTS.md" "global AGENTS.md after init"
assert_file_exists "$HOME/.agents/skills/my-commit/SKILL.md" "my-commit codex skill after init"
assert_file_exists "$HOME/.agents/skills/my-commit/agents/openai.yaml" "Codex sidecar after init"

# --- Simulate drift: remove/mutate deployed global artifacts ----------------
# update's distinct value is an idempotent re-deploy that RESTORES the global
# install, not merely persisting init's leftovers. Damage three independent
# artifacts so the restore asserts below prove re-deploy, not no-op survival.
rm "$HOME/.codex/AGENTS.md"                                   # whole instruction file gone
rm "$HOME/.agents/skills/my-commit/SKILL.md"                  # a deployed skill body gone
: > "$HOME/.agents/skills/my-commit/agents/openai.yaml"       # sidecar truncated to empty

# Confirm the drift actually took (guards against a typo silently passing later).
if [ -f "$HOME/.codex/AGENTS.md" ]; then fail "drift setup: AGENTS.md still present"; else ok "drift: AGENTS.md removed"; fi
if [ -f "$HOME/.agents/skills/my-commit/SKILL.md" ]; then fail "drift setup: SKILL.md still present"; else ok "drift: my-commit SKILL.md removed"; fi
if [ -s "$HOME/.agents/skills/my-commit/agents/openai.yaml" ]; then fail "drift setup: sidecar still non-empty"; else ok "drift: sidecar truncated"; fi

# --- Re-deploy via update (the stateless global-only re-init) ----------------
"$KIT_ROOT/bin/agent-kit" update --preset engineering --agents codex \
  || { fail "agent-kit update exited non-zero"; exit 1; }
ok "update re-deployed without prompts (exit 0)"

# --- Assert the global install is idempotently restored ----------------------
assert_file_exists "$HOME/.codex/AGENTS.md" "global AGENTS.md restored by update"
assert_content_contains "$HOME/.codex/AGENTS.md" "Core Instructions" "core instruction in restored AGENTS.md"
assert_file_exists "$HOME/.agents/skills/my-commit/SKILL.md" "my-commit SKILL.md restored by update"
# Sidecar regenerated (non-empty) — my-commit sets disable-model-invocation: true.
assert_file_exists "$HOME/.agents/skills/my-commit/agents/openai.yaml" "Codex sidecar restored by update"
if [ -s "$HOME/.agents/skills/my-commit/agents/openai.yaml" ]; then ok "sidecar non-empty after restore"; else fail "sidecar still empty after update"; fi
assert_content_contains "$HOME/.agents/skills/my-commit/agents/openai.yaml" "allow_implicit_invocation: false" "regenerated sidecar carries manual-only policy"

# Stateless-contract negative: update must NOT write a per-repo state file.
if [ -f "$WORK/.agent-kit.yaml" ]; then fail "update wrote $WORK/.agent-kit.yaml (state file must not exist)"; else ok "no .agent-kit.yaml written"; fi
