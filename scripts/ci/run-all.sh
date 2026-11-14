#!/usr/bin/env bash
# Usage: scripts/ci/run-all.sh [--release] [epic folder ...]. Runs every check and prints a table. Exit 1 if any check fails.
# Epic folders get require-signed-design. --release adds check-ac-coverage (all EARS ids need a test).
# override-report is an INFO row and never fails the run.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
release=0
epics=()
for a in "$@"; do
  if [ "$a" = "--release" ]; then release=1; else epics+=("$a"); fi
done

fails=0
rows=""
run() {
  local name="$1"; shift
  local out rc=0
  out=$("$@" 2>&1) || rc=$?
  local first
  first=$(printf '%s\n' "$out" | head -n1)
  if [ "$rc" -ne 0 ]; then fails=$((fails + 1)); fi
  rows="$rows$(printf '%-24s %-5s %s' "$name" "$([ "$rc" -eq 0 ] && echo PASS || echo FAIL)" "${first#*: }")
"
  if [ "$rc" -ne 0 ]; then printf '%s\n' "$out" | tail -n +2 >&2; fi
}
info() {   # informational row: never counts as a fail
  local name="$1" out; shift
  out=$("$@" 2>&1 || true)
  rows="$rows$(printf '%-24s %-5s %s' "$name" INFO "$(printf '%s\n' "$out" | head -n1 | sed 's/^[^:]*: //')")
"
  printf '%s\n' "$out" | grep '^REVIEW:' >&2 || true
}
skip() { rows="$rows$(printf '%-24s %-5s %s' "$1" SKIP "$2")
"; }

run check-versions         "$here/check-versions.sh"
run check-test-tree        "$here/check-test-tree.sh"
run check-fk-index         "$here/check-fk-index.sh"
run check-auth-in-actions  "$here/check-auth-in-actions.sh"
run check-no-console       "$here/check-no-console.sh"
run check-dashes           "$here/check-dashes.sh"
if [ "$release" -eq 1 ]; then run check-ac-coverage "$here/check-ac-coverage.sh"
else skip check-ac-coverage "release only, pass --release"; fi
if [ "${#epics[@]}" -gt 0 ]; then
  for e in "${epics[@]}"; do run "signed-design $(basename "$e")" "$here/require-signed-design.sh" "$e"; done
else skip require-signed-design "no epic folder given"; fi
info override-report "$here/override-report.sh"

printf '%-24s %-5s %s\n' CHECK RESULT DETAIL
printf '%s' "$rows"
if [ "$fails" -gt 0 ]; then echo "FAIL run-all: $fails check(s) failed"; exit 1; fi
echo "PASS run-all: all checks passed"
