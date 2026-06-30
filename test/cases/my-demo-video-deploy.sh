#!/usr/bin/env bash
# Wiring smoke test for my-demo-video. Asserts the deploy output contains the
# resident skill, worker agent, expanded visual routing snippet, spawn contract,
# local media recipe, capture branches, and fail-fast fallback language.

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

skill="$HOME/.claude/skills/my-demo-video/SKILL.md"
agent="$HOME/.claude/agents/my-demo-video-agent.md"

assert_file_exists "$skill" "my-demo-video SKILL.md deployed"
assert_file_exists "$agent" "my-demo-video-agent deployed"
assert_file_exists "$HOME/.claude/skills/web-visual-loop/SKILL.md" "web-visual-loop dependency deployed"
assert_file_exists "$HOME/.claude/skills/electron-visual-loop/SKILL.md" "electron-visual-loop dependency deployed"
assert_file_exists "$HOME/.claude/skills/desktop-app-loop/SKILL.md" "desktop-app-loop dependency deployed"

# Expanded routing snippet + explicit routed skill names.
assert_content_contains "$skill" "| \`web\` | \`web-visual-loop\` |" "skill expands web routing table"
assert_content_contains "$skill" "| \`electron\` | \`electron-visual-loop\` |" "skill expands electron routing table"
assert_content_contains "$skill" "| \`desktop\` | \`desktop-app-loop\` |" "skill expands desktop routing table"

# Thin resident spawn contract.
assert_content_contains "$skill" "my-demo-video-agent" "skill mentions worker agent"
assert_content_contains "$skill" "TARGET_ENV:" "skill spawn passes TARGET_ENV"
assert_content_contains "$skill" "ROUTED_LOOP:" "skill spawn passes ROUTED_LOOP"
assert_content_contains "$skill" "TARGET:" "skill spawn passes TARGET"
assert_content_contains "$skill" "DEMO_GOAL:" "skill spawn passes DEMO_GOAL"
assert_content_contains "$skill" "SCRIPT_OR_SOURCE:" "skill spawn passes SCRIPT_OR_SOURCE"
assert_content_contains "$skill" "OUTPUT_ROOT:" "skill spawn passes OUTPUT_ROOT"
assert_content_contains "$skill" "RUN_KEY:" "skill spawn passes RUN_KEY"

# Local-only media and sync tooling.
assert_content_contains "$agent" "npx hyperframes tts" "agent requires local hyperframes TTS"
assert_content_contains "$agent" "ffmpeg" "agent requires ffmpeg"
assert_content_contains "$agent" "ffprobe" "agent requires ffprobe"
assert_content_contains "$agent" "adelay" "agent uses adelay"
assert_content_contains "$agent" "amix" "agent uses amix"

# Web same-session recording and empirical artifact probe.
assert_content_contains "$agent" "agent-browser --session <RUN_KEY> record start" "agent records web in run session"
assert_content_contains "$agent" "record stop" "agent stops web recording"
assert_content_contains "$agent" "artifact-level empirical probe" "agent probes web recording artifact"
assert_content_contains "$agent" "driven visible change appears in the recorded artifact" "agent verifies driven change in recording"

# Desktop/Electron platform capture and unsupported-path fallback.
assert_content_contains "$agent" "gdigrab" "agent documents Windows gdigrab"
assert_content_contains "$agent" "x11grab" "agent documents Linux/X11 x11grab"
assert_content_contains "$agent" "avfoundation" "agent documents macOS avfoundation"
assert_content_contains "$agent" "frame-0 anchor" "agent aligns to frame-0 anchor"
assert_content_contains "$agent" "cannot provide deterministic ffmpeg capture" "agent fails fast on unsupported capture paths"

# Fail-fast synthetic fallback and run-scoped exact output.
assert_content_contains "$skill" "faceless-explainer" "skill points to synthetic fallback"
assert_content_contains "$skill" "stop" "skill requires stop/fail-fast behavior"
assert_content_contains "$skill" "~/.my-demo-video/<repo-key>/<run-key>/" "skill documents default run output"
assert_content_contains "$agent" "~/.my-demo-video/<repo-key>/<run-key>/" "agent documents default run output"
assert_content_contains "$skill" "OUTPUT_ROOT" "skill includes OUTPUT_ROOT"
assert_content_contains "$agent" "OUTPUT_ROOT" "agent includes OUTPUT_ROOT"
assert_content_contains "$skill" "RUN_KEY" "skill includes RUN_KEY"
assert_content_contains "$agent" "RUN_KEY" "agent includes RUN_KEY"
assert_content_contains "$agent" "ROUTED_LOOP" "agent consumes ROUTED_LOOP"
assert_content_contains "$skill" "exact final MP4 path" "skill requires exact MP4 path"
assert_content_contains "$agent" "exact final MP4 path" "agent returns exact MP4 path"
