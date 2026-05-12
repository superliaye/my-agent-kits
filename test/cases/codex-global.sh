#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

"$KIT_ROOT/bin/agent-kit" init --preset engineering --agents codex --scope global \
  || { fail "agent-kit init --scope global exited non-zero"; exit 1; }

# Positive: AGENTS.md written directly to where Codex reads (no APM-staged copy step)
assert_file_exists "$HOME/.codex/AGENTS.md" "global AGENTS.md"
assert_content_contains "$HOME/.codex/AGENTS.md" "Core Instructions" "core instruction in global AGENTS.md"

# Negative: no APM artifacts at user scope
if [ -f "$HOME/.apm/apm.yml" ]; then fail "~/.apm/apm.yml should not be written"; else ok "no ~/.apm/apm.yml created"; fi
if [ -f "$HOME/.apm/AGENTS.md" ]; then fail "~/.apm/AGENTS.md should not be written (we write directly to ~/.codex/)"; else ok "no ~/.apm/AGENTS.md staging file"; fi
