#!/usr/bin/env bash
# Every SKILL.md and AGENT.md declares a frontmatter `name:` equal to its folder.
# Deploy installs each capability under its folder name, so a missing or different
# `name:` makes the invocable name depend on the host's fallback rules.
# Static source check — no deploy, no $HOME writes.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

# Hive's name schema rejects uppercase, so this skill relies on the folder fallback
# until it is renamed.
EXEMPT=" improve-DDD-architecture "

while IFS= read -r file; do
  dir="$(basename "$(dirname "$file")")"
  case "$EXEMPT" in *" $dir "*) continue ;; esac
  name="$(awk 'NR==1&&/^---$/{f=1;next} f&&/^---$/{exit} f&&/^name:/{sub(/^name:[ \t]*/,"");print;exit}' "$file")"
  if [ "$name" = "$dir" ]; then
    ok "$dir declares matching name"
  else
    fail "$dir: name '${name}' must equal folder name (${file#"$KIT_ROOT/"})"
  fi
done < <(find "$KIT_ROOT/capabilities/skills" "$KIT_ROOT/capabilities/agents" \
  \( -name SKILL.md -o -name AGENT.md \) -not -path '*/_unshipped/*' | sort)

[ "$FAIL" -eq 0 ]
