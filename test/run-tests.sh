#!/usr/bin/env bash
# Iterate test/cases/*.sh, aggregate pass/fail.
#
# This runner can write to the host's real $HOME/.claude/ and $HOME/.codex/ for
# any case that does not isolate $HOME — by design, since those code paths
# write to those exact locations in production. Inside the Docker image
# (test/Dockerfile.test) HOME is the container's clean HOME, so this is safe.
# On a host machine it overwrites your live agent config.
#
# Default flow: `npm test` builds + runs the Docker image. Use `npm run test:host`
# (which sets AGENT_KIT_TEST_HOST=1) to opt in to host execution.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="$( cd "$HERE/.." && pwd )"
export KIT_ROOT

if [ -f /.dockerenv ]; then
  : # inside the test container — proceed silently
elif [ -n "${AGENT_KIT_TEST_HOST:-}" ]; then
  cat <<'BANNER'
================================================================
HOST MODE — this run touches your real ~/.claude/ and ~/.codex/.
  global-deploy cases that don't isolate $HOME will overwrite CLAUDE.md /
  AGENTS.md and may delete ~/.claude/plugins/ and ~/.apm/. Ctrl+C now if not intended.
For isolated runs use: npm test  (Docker)
================================================================
BANNER
else
  cat >&2 <<'REFUSE'
Refusing to run in host mode (would touch your real ~/.claude/ and ~/.codex/).

Default isolated run:   npm test            # Docker; Unix-only validation
Opt in to host mode:    npm run test:host   # uses real $HOME on this machine
REFUSE
  exit 2
fi
TOTAL_PASS=0
TOTAL_FAIL=0
CASES_PASSED=()
CASES_FAILED=()

command -v node >/dev/null || { echo "Error: node not found"; exit 1; }
command -v git  >/dev/null || { echo "Error: git not found";  exit 1; }

[ ! -d "$KIT_ROOT/node_modules" ] && ( cd "$KIT_ROOT" && npm install --no-audit --no-fund --silent )

for case_script in "$HERE"/cases/*.sh; do
  case_name="$(basename "$case_script" .sh)"
  echo ""
  echo "[$case_name]"
  # Have each case subshell write its PASS/FAIL counts to a tmp file we can read.
  COUNT_FILE="$(mktemp)"
  export COUNT_FILE
  if bash "$case_script"; then
    case_pass=$(grep -c '^pass$' "$COUNT_FILE" 2>/dev/null); case_pass=${case_pass:-0}
    case_fail=$(grep -c '^fail$' "$COUNT_FILE" 2>/dev/null); case_fail=${case_fail:-0}
    TOTAL_PASS=$((TOTAL_PASS + case_pass))
    TOTAL_FAIL=$((TOTAL_FAIL + case_fail))
    if [ "$case_fail" -eq 0 ]; then
      CASES_PASSED+=("$case_name")
    else
      CASES_FAILED+=("$case_name")
    fi
  else
    CASES_FAILED+=("$case_name")
  fi
  rm -f "$COUNT_FILE"
done

echo ""
echo "================================================================"
echo "Results: ${#CASES_PASSED[@]} cases passed, ${#CASES_FAILED[@]} cases failed"
echo "Asserts: $TOTAL_PASS passed, $TOTAL_FAIL failed"
[ ${#CASES_FAILED[@]} -gt 0 ] && {
  echo "Failed: ${CASES_FAILED[*]}"
  exit 1
}
exit 0
