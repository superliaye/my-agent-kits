#!/usr/bin/env bash
# Wiring smoke test for my-mermaid's type-selection head. Asserts the structure
# survives deploy: the skill carries the "Pick the diagram type" step, has WebFetch
# (the live-catalog read), and passes TYPE into the spawn; the agent declares the
# TYPE input. It can't assert the *selection logic* — that's instruction behavior,
# not deployable structure — so it only guards the wiring from silent regression.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

# Isolate BOTH HOME and USERPROFILE so global writes land in a throwaway dir.
TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"; git init -q .

"$KIT_ROOT/bin/agent-kit" init --preset productivity --agents claude \
  || { fail "agent-kit init exited non-zero"; exit 1; }

skill="$HOME/.claude/skills/my-mermaid/SKILL.md"
agent="$HOME/.claude/agents/my-mermaid-agent.md"

assert_file_exists "$skill" "my-mermaid SKILL.md deployed"
assert_file_exists "$agent" "my-mermaid-agent deployed"

# The type-selection head and its live-catalog read survive deploy.
assert_content_contains "$skill" "Pick the diagram type" "skill carries the type-selection step"
assert_content_contains "$skill" "WebFetch" "skill allows WebFetch for the live catalog read"

# The spawn contract passes the chosen type to the agent, which declares it.
assert_content_contains "$skill" "TYPE:" "skill spawn passes TYPE"
assert_content_contains "$agent" "the diagram type to author" "agent declares the TYPE input"
