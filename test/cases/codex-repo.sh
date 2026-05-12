#!/usr/bin/env bash
set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
. "$HERE/../lib/assertions.sh"

WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
cd "$WORK"
git init -q .

agent-kit init --preset engineering --agents codex --scope repo \
  || { fail "agent-kit init exited non-zero"; exit 1; }

# Positive: what Codex reads
assert_file_exists "$WORK/AGENTS.md" "AGENTS.md"
assert_content_contains "$WORK/AGENTS.md" "Core Instructions" "core instruction in AGENTS.md"
assert_content_contains "$WORK/AGENTS.md" "Karpathy" "karpathy instruction in AGENTS.md"
assert_size_under "$WORK/AGENTS.md" 32768 "AGENTS.md size <= 32 KiB"
assert_file_exists "$WORK/.agent-kit.yaml" "state file"

# Skills land at cross-client `.agents/skills/<name>/` location; engineering preset ships 9 skills.
assert_dir_nonempty "$WORK/.agents/skills" "cross-client skills root"
assert_file_exists "$WORK/.agents/skills/my-commit/SKILL.md" "my-commit skill deployed"

# Wizard generates Codex sidecar with allow_implicit_invocation: false
# for any skill whose frontmatter has disable-model-invocation: true.
assert_file_exists "$WORK/.agents/skills/my-commit/agents/openai.yaml" "Codex sidecar generated"
assert_content_contains "$WORK/.agents/skills/my-commit/agents/openai.yaml" "allow_implicit_invocation: false" "sidecar policy correct"

# Negative: no APM artifacts
if [ -f "$WORK/apm.yml" ]; then fail "apm.yml should not be written"; else ok "no apm.yml created"; fi
if [ -d "$WORK/apm_modules" ]; then fail "apm_modules/ should not be created"; else ok "no apm_modules/ created"; fi
