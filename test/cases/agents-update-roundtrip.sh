#!/usr/bin/env bash
# Regression guard for the manifest host/capability key split: `init` then
# `update --current` must REDEPLOY the selected agents, not crash or orphan them.
# (The manifest's top-level `agents` is the deploy host list; the agent capability
# selection lives under `agentDefs` — collapsing them broke update.)

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
trap "rm -rf '$TMPHOME' '$WORK'" EXIT
cd "$WORK"; git init -q .

AGENT_KIT_SKIP_PLUGIN_INSTALL=1 "$KIT_ROOT/bin/agent-kit" init \
  --preset loop --agents claude,codex \
  || { fail "init exited non-zero"; exit 1; }

for a in architecture-review rules-enforcer general-review design-critic product-critic; do
  assert_file_exists "$HOME/.claude/agents/$a.md" "post-init: $a (claude)"
done

# Manifest stores hosts under `agents`, capabilities under `agentDefs` (no collision).
node -e '
const fs=require("fs"), os=require("os"), path=require("path");
const m=JSON.parse(fs.readFileSync(path.join(os.homedir(),".agent-kit","manifest.json"),"utf8"));
const hostsOk=Array.isArray(m.agents)&&m.agents.every(x=>typeof x==="string");
const defs=(m.agentDefs||[]).map(x=>x.name).sort().join(",");
process.exit(hostsOk && defs==="architecture-review,design-critic,general-review,loop-build-acceptance,loop-build-agent,product-critic,rules-enforcer" ? 0 : 1);
' && ok "manifest: agents=hosts, agentDefs=the loop preset's 7 capabilities" || fail "manifest host/capability split wrong"

# The regression: update --current must succeed and keep the agents deployed.
AGENT_KIT_SKIP_PLUGIN_INSTALL=1 "$KIT_ROOT/bin/agent-kit" update --current >/tmp/akit-update.log 2>&1 \
  && ok "update --current exited 0" || fail "update --current crashed (see /tmp/akit-update.log)"

if grep -qiE "Unknown agent" /tmp/akit-update.log; then fail "update hit a resolveAgent error"; else ok "no resolveAgent error in update"; fi

for a in architecture-review rules-enforcer general-review design-critic product-critic; do
  assert_file_exists "$HOME/.claude/agents/$a.md"  "post-update: $a still deployed (claude)"
  assert_file_exists "$HOME/.codex/agents/$a.toml" "post-update: $a still deployed (codex)"
done
