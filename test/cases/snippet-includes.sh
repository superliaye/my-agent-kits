#!/usr/bin/env bash
# Snippet include inliner (lib/deploy.js): SKILL.md is strict (an unknown marker
# fails the deploy), bundled .md files are lenient (an unknown marker is left
# verbatim so docs can demonstrate the syntax). Pure-function unit checks via
# test/lib/snippet-includes.mjs — no wizard deploy, no $HOME writes.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

OUT="$(node "$HERE/../lib/snippet-includes.mjs" 2>&1)"
RC=$?
if [ $RC -ne 0 ]; then fail "snippet-includes.mjs exited $RC: $OUT"; fi

while IFS='|' read -r status label; do
  case "${status:-}" in
    PASS) ok "$label" ;;
    FAIL) fail "$label" ;;
  esac
done <<< "$OUT"
