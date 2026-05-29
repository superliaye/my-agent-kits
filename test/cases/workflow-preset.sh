#!/usr/bin/env bash
# Verify the `workflow` preset deploys the orchestrator skill + its
# supporting skills (those that exist in the kit at this point), and
# records the right plugin set in .agent-kit.yaml.
#
# The two dependency skills not yet built (e2e-validate,
# improve-DDD-architecture) are silently skipped by lib/deploy.js
# (line 153: `if (!existsSync(srcDir)) continue;`). PR 04 + PR 05
# will land them.
#
# AGENT_KIT_SKIP_PLUGIN_INSTALL=1 prevents touching the live Claude
# Code plugin set.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

AGENT_KIT_SKIP_PLUGIN_INSTALL=1 "$KIT_ROOT/bin/agent-kit" init \
  --preset workflow --agents claude --scope repo \
  || { fail "agent-kit init --preset workflow exited non-zero"; exit 1; }

# Orchestrator skill landed
assert_file_exists "$WORK/.claude/skills/workflow/SKILL.md" "workflow SKILL.md deployed"
assert_file_exists "$WORK/.claude/skills/workflow/orchestrator.sh" "workflow orchestrator.sh deployed"
assert_file_exists "$WORK/.claude/skills/workflow/state-template.md" "workflow state-template.md deployed"
assert_file_exists "$WORK/.claude/skills/workflow/lib/state-ops.sh" "workflow lib/state-ops.sh deployed"

# All 13 phase prompt stubs present
for stub in \
  phase1-plan phase2-plan-review phase3-design phase4-implement \
  phase5-validate phase6-arch phase6-ddd phase6-general \
  phase7-triage phase8-design-critique phase9-documentation \
  phase10-summary phase11-reflection; do
  assert_file_exists "$WORK/.claude/skills/workflow/prompts/$stub.md" "workflow prompt stub: $stub"
done

# SKILL.md describes /workflow as a tagged-queue cybernetic loop
assert_content_contains "$WORK/.claude/skills/workflow/SKILL.md" "tagged work-item queue" "SKILL.md mentions tagged queue"
assert_content_contains "$WORK/.claude/skills/workflow/SKILL.md" "orchestrator.sh" "SKILL.md references orchestrator"

# Supporting skills the preset DOES include (those that exist today)
assert_file_exists "$WORK/.claude/skills/improve-codebase-architecture/SKILL.md" "improve-codebase-architecture deployed"
assert_file_exists "$WORK/.claude/skills/diagnose/SKILL.md" "diagnose deployed"
assert_file_exists "$WORK/.claude/skills/design-critique/SKILL.md" "design-critique deployed"
assert_file_exists "$WORK/.claude/skills/electron-visual-loop/SKILL.md" "electron-visual-loop deployed"
assert_file_exists "$WORK/.claude/skills/web-visual-loop/SKILL.md" "web-visual-loop deployed"

# Core instruction concatenated
assert_file_exists "$WORK/CLAUDE.md" "CLAUDE.md generated"
assert_content_contains "$WORK/CLAUDE.md" "Core Instructions" "core instruction in CLAUDE.md"

# State recorded — preset + plugins
assert_content_contains "$WORK/.agent-kit.yaml" "preset: workflow" "preset recorded"
assert_content_contains "$WORK/.agent-kit.yaml" "workflow" "workflow skill in state"
assert_content_contains "$WORK/.agent-kit.yaml" "ui-ux-pro-max" "ui-ux-pro-max plugin in state"
assert_content_contains "$WORK/.agent-kit.yaml" "frontend-design" "frontend-design plugin in state"

# Negative: code-review plugin NOT in workflow preset (per Q-phase6 — wrong shape)
if grep -q "code-review" "$WORK/.agent-kit.yaml"; then
  fail "code-review should NOT be in workflow preset (per Q-phase6)"
else
  ok "code-review correctly absent from workflow preset"
fi

# Bootstrap smoke: orchestrator writes initial state.md
mkdir -p "$WORK/.workflow"
# The installed orchestrator path under the test workspace
INSTALLED_ORCH="$WORK/.claude/skills/workflow/orchestrator.sh"
# The installed orchestrator expects a Claude CLI on PATH. Stub it
# with a no-op fixture so bootstrap completes without invoking real
# Claude.
STUB_DIR="$(mktemp -d)"
cat > "$STUB_DIR/claude-stub.sh" <<'STUB'
#!/usr/bin/env bash
# Stub: replace state with a terminal-friendly snapshot so bootstrap
# returns quickly.
STATE_FILE="$3"
cat > "$STATE_FILE" <<EOF
# workflow state

meta:
  schema-version: 1
  iteration: 0
  ui_work: false
  phase-9-done: true
  phase-10-done: true
  phase-11-done: true

---
id: item-001
tag: to-plan
status: done
emitted-by-phase: 0
artifact: .workflow/plan.md
permissions:
parent:
title: smoke bootstrap
---
EOF
STUB
chmod +x "$STUB_DIR/claude-stub.sh"

WORKFLOW_TEST_DISPATCH_HOOK="$STUB_DIR/claude-stub.sh" \
  bash "$INSTALLED_ORCH" --workdir "$WORK/.workflow" --user-request "smoke test" >/dev/null 2>&1
rc=$?

if [ "$rc" -eq 0 ]; then
  ok "installed orchestrator bootstrap + dispatch path: rc=0"
else
  fail "installed orchestrator bootstrap: rc=$rc"
fi

assert_file_exists "$WORK/.workflow/state.md" "smoke: state.md written by installed orchestrator"
assert_content_contains "$WORK/.workflow/state.md" "schema-version: 1" "smoke: state.md valid schema"
