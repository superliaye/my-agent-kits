#!/usr/bin/env bash
# Iterate test/cases/*.sh, aggregate pass/fail.

set -u
HERE="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
KIT_ROOT="$( cd "$HERE/.." && pwd )"
export KIT_ROOT
TOTAL_PASS=0
TOTAL_FAIL=0
CASES_PASSED=()
CASES_FAILED=()

command -v node >/dev/null || { echo "Error: node not found"; exit 1; }
command -v apm  >/dev/null || { echo "Error: apm not found";  exit 1; }
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
