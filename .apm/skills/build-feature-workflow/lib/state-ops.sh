#!/usr/bin/env bash
# Bash 3.2-compatible helpers for parsing `.build-feature-workflow/state.md`.
#
# Layout reference: `.apm/skills/build-feature-workflow/state-template.md`.
# Invariants enforced by wfs_validate:
#   5.4 skip-eligible only from phases 7/8
#   5.5 skip tags only on skip-eligible items
#   5.8 emitted-by-phase present + integer 0-11
#   5.9 done items have artifact or skip
#   5.10 escalations (ASK/HUMAN/DECISION) have artifact (audit reference)
#   5.12 schema-version == 1
#
# This file is sourced by:
#   - .apm/skills/build-feature-workflow/orchestrator.sh
#   - test/cases/build-feature-workflow-state-machine.sh
# All read functions accept the state file path as $1, write to stdout.

# --- Meta ----------------------------------------------------------------

wfs_meta() {
  local key="$1" file="$2"
  awk -v K="$key" '
    /^meta:/         { in_meta=1; next }
    in_meta && /^[^ ]/ { in_meta=0 }
    in_meta {
      sub(/^[ \t]+/, "")
      idx = index($0, ":")
      if (idx > 0) {
        k = substr($0, 1, idx-1)
        v = substr($0, idx+1)
        sub(/^[ \t]+/, "", v)
        sub(/[ \t]+$/, "", v)
        if (k == K) { print v; exit }
      }
    }
  ' "$file"
}

# --- Records -------------------------------------------------------------

# Emit each item record (between --- separators) as a NUL-delimited blob
# on stdout. Each blob contains the raw key:value lines of one item.
wfs__records() {
  local file="$1"
  awk '
    BEGIN { rec=""; in_rec=0 }
    /^---[ \t]*$/ {
      if (in_rec && rec ~ /[^ \t\n]/) { printf "%s%c", rec, 0 }
      rec=""; in_rec=1; next
    }
    in_rec { rec = rec $0 "\n" }
    END { if (in_rec && rec ~ /[^ \t\n]/) printf "%s%c", rec, 0 }
  ' "$file"
}

wfs__field() {
  local key="$1"
  awk -v K="$key" '
    {
      idx = index($0, ":")
      if (idx > 0) {
        k = substr($0, 1, idx-1)
        v = substr($0, idx+1)
        sub(/^[ \t]+/, "", v)
        sub(/[ \t]+$/, "", v)
        if (k == K) { print v; exit }
      }
    }
  '
}

# --- Item readers --------------------------------------------------------

wfs_item_ids() {
  local file="$1"
  local rec
  while IFS= read -r -d '' rec; do
    printf '%s\n' "$rec" | wfs__field id
  done < <(wfs__records "$file")
}

wfs_item_field() {
  local id="$1" key="$2" file="$3"
  local rec rec_id
  while IFS= read -r -d '' rec; do
    rec_id=$(printf '%s' "$rec" | wfs__field id)
    if [ "$rec_id" = "$id" ]; then
      printf '%s' "$rec" | wfs__field "$key"
      return 0
    fi
  done < <(wfs__records "$file")
  return 0
}

# Lines: "<id> <tag> <emitted-by-phase>"
wfs_dispatchable_items() {
  local file="$1"
  local rec status tag id phase
  while IFS= read -r -d '' rec; do
    status=$(printf '%s' "$rec" | wfs__field status)
    tag=$(printf '%s' "$rec" | wfs__field tag)
    if [ "$status" = "pending" ] && _wfs_is_dispatchable_tag "$tag"; then
      id=$(printf '%s' "$rec" | wfs__field id)
      phase=$(printf '%s' "$rec" | wfs__field emitted-by-phase)
      printf '%s %s %s\n' "$id" "$tag" "$phase"
    fi
  done < <(wfs__records "$file")
}

# Lines: "<id> <status>" for ASK/HUMAN/DECISION
wfs_escalated_items() {
  local file="$1"
  local rec status id
  while IFS= read -r -d '' rec; do
    status=$(printf '%s' "$rec" | wfs__field status)
    case "$status" in
      ASK|HUMAN|DECISION)
        id=$(printf '%s' "$rec" | wfs__field id)
        printf '%s %s\n' "$id" "$status"
        ;;
    esac
  done < <(wfs__records "$file")
}

_wfs_is_dispatchable_tag() {
  case "$1" in
    to-plan|to-review-plan|to-design|to-implement) return 0 ;;
    code-complete-needs-verification|to-code-review) return 0 ;;
    to-triage|to-design-critique) return 0 ;;
    *) return 1 ;;
  esac
}

wfs_phase_for_tag() {
  case "$1" in
    to-plan)                          echo 1 ;;
    to-review-plan)                   echo 2 ;;
    to-design)                        echo 3 ;;
    to-implement)                     echo 4 ;;
    code-complete-needs-verification) echo 5 ;;
    to-code-review)                   echo 6 ;;
    to-triage)                        echo 7 ;;
    to-design-critique)               echo 8 ;;
    *)                                echo 0 ;;
  esac
}

# --- Validation ----------------------------------------------------------

wfs_validate() {
  local file="$1"

  if [ ! -f "$file" ]; then
    echo "wfs_validate: $file does not exist" >&2
    return 1
  fi

  local schema
  schema=$(wfs_meta schema-version "$file")
  if [ "$schema" != "1" ]; then
    echo "wfs_validate: refusing schema-version '$schema' (need 1)" >&2
    return 1
  fi

  local rec id tag status phase permissions skip artifact
  local rc=0
  while IFS= read -r -d '' rec; do
    id=$(printf '%s' "$rec" | wfs__field id)
    tag=$(printf '%s' "$rec" | wfs__field tag)
    status=$(printf '%s' "$rec" | wfs__field status)
    phase=$(printf '%s' "$rec" | wfs__field emitted-by-phase)
    permissions=$(printf '%s' "$rec" | wfs__field permissions)
    skip=$(printf '%s' "$rec" | wfs__field skip)
    artifact=$(printf '%s' "$rec" | wfs__field artifact)

    # 5.8 emitted-by-phase present + integer 0-11
    case "$phase" in
      ''|*[!0-9]*)
        echo "wfs_validate: item $id invalid emitted-by-phase '$phase'" >&2
        rc=1; break
        ;;
    esac
    if [ "$phase" -lt 0 ] || [ "$phase" -gt 11 ]; then
      echo "wfs_validate: item $id emitted-by-phase out of range: $phase" >&2
      rc=1; break
    fi

    # 5.4 skip-eligible only from phase 7/8
    case ",$permissions," in
      *,skip-eligible,*)
        if [ "$phase" != "7" ] && [ "$phase" != "8" ]; then
          echo "wfs_validate: item $id has skip-eligible from phase $phase (must be 7 or 8)" >&2
          rc=1; break
        fi
        ;;
    esac

    # 5.5 skip tags only on skip-eligible items
    if [ -n "$skip" ]; then
      case ",$permissions," in
        *,skip-eligible,*) : ;;
        *)
          echo "wfs_validate: item $id declares skip '$skip' without skip-eligible permission" >&2
          rc=1; break
          ;;
      esac
    fi

    # 5.9 done items have artifact OR skip
    if [ "$status" = "done" ]; then
      if [ -z "$artifact" ] && [ -z "$skip" ]; then
        echo "wfs_validate: done item $id has neither artifact nor skip" >&2
        rc=1; break
      fi
    fi

    # 5.10 escalations have artifact (audit target)
    case "$status" in
      ASK|HUMAN|DECISION)
        if [ -z "$artifact" ]; then
          echo "wfs_validate: escalated item $id ($status) has no artifact audit reference" >&2
          rc=1; break
        fi
        ;;
    esac

    # 5.11 escalation keyword in tag but non-escalation status = misencoded
    # escalation (escalations live in status, not tag; otherwise the item
    # matches neither the dispatch nor the escalation set and is dropped)
    case "$tag" in
      ASK|HUMAN|DECISION)
        case "$status" in
          ASK|HUMAN|DECISION) : ;;
          *)
            echo "wfs_validate: item $id has escalation keyword '$tag' in tag but status '$status' (escalations live in status, not tag)" >&2
            rc=1; break
            ;;
        esac
        ;;
    esac
  done < <(wfs__records "$file")

  return $rc
}
