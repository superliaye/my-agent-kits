#!/usr/bin/env bash
# Deploy my-domain-vocab via the productivity preset and run its runtime contract.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

TMPROOT="$(mktemp -d)"
trap "rm -rf '$TMPROOT'" EXIT
HOME_DIR="$TMPROOT/home"
WORK="$TMPROOT/work"
mkdir -p "$HOME_DIR" "$WORK"
git -C "$WORK" init -q .

if (cd "$WORK" && HOME="$HOME_DIR" USERPROFILE="$HOME_DIR" AGENT_KIT_SKIP_PLUGIN_INSTALL=1 AGENT_KIT_SKIP_BUNDLE_INSTALL=1 \
  "$KIT_ROOT/bin/agent-kit" init --preset productivity --agents claude,codex >/dev/null); then
  ok "productivity deploys my-domain-vocab for Claude and Codex"
else
  fail "productivity my-domain-vocab deploy failed"
fi

for root in "$HOME_DIR/.claude/skills/my-domain-vocab" "$HOME_DIR/.agents/skills/my-domain-vocab"; do
  label="$(basename "$(dirname "$(dirname "$root")")") my-domain-vocab"
  assert_file_exists "$root/SKILL.md" "$label entrypoint"
  assert_file_exists "$root/scripts/vocab.mjs" "$label script"
  assert_content_contains "$root/SKILL.md" "added_in: 0.51.0" "$label version"
  for mode in "### Ingest" "### Learn" "### Hygiene"; do
    assert_content_contains "$root/SKILL.md" "$mode" "$label names mode ${mode#\#\#\# }"
  done
  for choice in "**Archive**" "**I recognize it**" "**Don't know**" "**Free text**" "Judge it" "sharpen"; do
    assert_content_contains "$root/SKILL.md" "$choice" "$label card offers $choice"
  done
done

DEPLOYED="$HOME_DIR/.agents/skills/my-domain-vocab"
if grep -E "node:(https?|net|dgram|tls)|fetch\(" "$DEPLOYED/scripts/vocab.mjs" >/dev/null; then
  fail "my-domain-vocab script reaches the network"
else
  ok "my-domain-vocab script stays local"
fi

if HOME="$HOME_DIR" USERPROFILE="$HOME_DIR" MY_DOMAIN_VOCAB_SKILL="$DEPLOYED" node "$HERE/../lib/my-domain-vocab-runtime.mjs"; then
  ok "my-domain-vocab phrase evidence, schedule, archive, persistence, and storage contract"
else
  fail "my-domain-vocab runtime contract"
fi

[ "$FAIL" -eq 0 ]
