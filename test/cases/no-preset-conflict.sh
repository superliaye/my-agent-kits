#!/usr/bin/env bash
# --no-preset and --preset are mutually exclusive: combining them hard-errors
# with "Cannot combine --no-preset with --preset", in BOTH the --agents form
# (which would otherwise go non-interactive) and the --agents-less form (which
# would otherwise prompt). The guard is hoisted above intro() so neither path
# prints the banner first.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

# Isolate BOTH HOME and USERPROFILE so nothing lands in the real config.
TMPHOME="$(mktemp -d)"; export HOME="$TMPHOME" USERPROFILE="$TMPHOME"
WORK="$(mktemp -d)"
cleanup() {
  rm -rf "$WORK" "$TMPHOME"
}
trap cleanup EXIT

cd "$WORK"
git init -q .

# --agents form: non-interactive, must hard-error with the conflict message.
OUT="$("$KIT_ROOT/bin/agent-kit" init --no-preset --preset engineering --agents claude 2>&1)"
if [ $? -ne 0 ]; then
  ok "init --no-preset --preset --agents exits non-zero"
else
  fail "init --no-preset --preset --agents should have exited non-zero"
fi
if printf '%s' "$OUT" | grep -q -F "Cannot combine --no-preset with --preset"; then
  ok "conflict message printed"
else
  fail "expected 'Cannot combine --no-preset with --preset' (got: $OUT)"
fi

# --agents-less form: must also hard-error before any prompt. Redirect stdin
# from /dev/null so an unexpected prompt can't hang the test.
if "$KIT_ROOT/bin/agent-kit" init --no-preset --preset engineering </dev/null >/dev/null 2>&1; then
  fail "init --no-preset --preset (no --agents) should have exited non-zero"
else
  ok "init --no-preset --preset (no --agents) exits non-zero"
fi
