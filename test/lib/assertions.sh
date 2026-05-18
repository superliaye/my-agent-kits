#!/usr/bin/env bash
# Shared assertion helpers for test cases.

PASS=${PASS:-0}
FAIL=${FAIL:-0}

# COUNT_FILE is set by run-tests.sh; ok/fail append a marker each call so the
# runner can grep-count after the subshell exits (subshell var counts don't
# propagate, and trap-EXIT doesn't work because cases set their own EXIT trap).
ok()   { echo "  [pass] $1"; PASS=$((PASS+1)); [ -n "${COUNT_FILE:-}" ] && echo "pass" >> "$COUNT_FILE"; return 0; }
fail() { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); [ -n "${COUNT_FILE:-}" ] && echo "fail" >> "$COUNT_FILE"; return 1; }

assert_file_exists() {
  local path="$1"; local label="${2:-$path}"
  if [ -f "$path" ]; then ok "$label exists"; else fail "$label missing ($path)"; fi
}

assert_dir_exists() {
  local path="$1"; local label="${2:-$path}"
  if [ -d "$path" ]; then ok "$label exists"; else fail "$label missing ($path)"; fi
}

assert_dir_nonempty() {
  local path="$1"; local label="${2:-$path}"
  if [ -d "$path" ] && [ -n "$(ls -A "$path" 2>/dev/null)" ]; then
    ok "$label non-empty"
  else
    fail "$label empty or missing ($path)"
  fi
}

assert_content_contains() {
  local path="$1"; local needle="$2"; local label="${3:-content match}"
  if [ -f "$path" ] && grep -q -F "$needle" "$path"; then
    ok "$label"
  else
    fail "$label (path=$path needle=$needle)"
  fi
}

assert_size_under() {
  local path="$1"; local max="$2"; local label="${3:-size}"
  if [ -f "$path" ]; then
    local sz
    sz=$(stat -c%s "$path" 2>/dev/null || stat -f%z "$path")
    if [ "$sz" -le "$max" ]; then ok "$label ($sz <= $max)"; else fail "$label too large ($sz > $max)"; fi
  else
    fail "$label: file missing ($path)"
  fi
}

assert_files_equal() {
  local a="$1"; local b="$2"; local label="${3:-files equal}"
  if cmp -s "$a" "$b"; then ok "$label"; else fail "$label ($a != $b)"; fi
}
