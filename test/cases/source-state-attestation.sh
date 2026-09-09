#!/usr/bin/env bash
# The acceptance attestation tracks the Git-visible source state while leaving
# ignored and unchanged tracked content outside its change-proportional input.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="${KIT_ROOT:-$( cd "$HERE/../.." && pwd )}"
. "$HERE/../lib/assertions.sh"

WORK="$(mktemp -d)"
trap "rm -rf '$WORK'" EXIT
git -C "$WORK" init -q .
git -C "$WORK" config user.name test
git -C "$WORK" config user.email test@example.com
git -C "$WORK" config core.hooksPath /dev/null
printf 'tracked\n' > "$WORK/tracked.txt"
printf 'ignored.txt\n' > "$WORK/.gitignore"
git -C "$WORK" add tracked.txt .gitignore
git -C "$WORK" commit -qm base

attest() {
  (cd "$WORK" && awk '
    /^node <<'\''NODE'\''$/ { capture=1; next }
    capture && /^NODE$/ { exit }
    capture { print }
  ' "$KIT_ROOT/capabilities/snippets/source-state-attestation.md" | node)
}

base="$(attest)"
case "$base" in
  sha256:[0-9a-f][0-9a-f]*) ok "attestation emits a sha256 digest" ;;
  *) fail "attestation output is malformed: $base" ;;
esac

[ "$(attest)" = "$base" ] \
  && ok "unchanged source state is stable" \
  || fail "unchanged source state changed digest"

printf 'tracked changed\n' > "$WORK/tracked.txt"
[ "$(attest)" != "$base" ] \
  && ok "tracked worktree changes affect attestation" \
  || fail "tracked worktree change was missed"
printf 'tracked\n' > "$WORK/tracked.txt"

printf 'untracked\n' > "$WORK/untracked.txt"
untracked="$(attest)"
[ "$untracked" != "$base" ] \
  && ok "untracked entries affect attestation" \
  || fail "untracked entry was missed"
printf 'untracked changed\n' > "$WORK/untracked.txt"
[ "$(attest)" != "$untracked" ] \
  && ok "untracked content changes affect attestation" \
  || fail "untracked content change was missed"

rm "$WORK/untracked.txt"
printf 'ignored\n' > "$WORK/ignored.txt"
[ "$(attest)" = "$base" ] \
  && ok "ignored files remain outside attestation" \
  || fail "ignored file changed attestation"
