#!/usr/bin/env bash
# Usage: scripts/ci/require-signed-design.sh <epic folder>. design.md front matter needs status: signed, signed_by (not empty), signed_on (YYYY-MM-DD).
# Why: build starts only after the human signs the design (human stop 2).
set -euo pipefail
dir="${1:-}"
if [ -z "$dir" ]; then echo "FAIL require-signed-design: usage: scripts/ci/require-signed-design.sh <epic folder>"; exit 1; fi
d="$dir/design.md"
if [ ! -f "$d" ]; then echo "FAIL require-signed-design: $d not found"; exit 1; fi

fm=$(tr -d '\r' < "$d" | awk 'NR == 1 { if ($0 != "---") exit; next } $0 == "---" { exit } { print }')
if [ -z "$fm" ]; then echo "FAIL require-signed-design: $d has no front matter"; exit 1; fi

get() {
  printf '%s\n' "$fm" | sed -n "s/^$1:[[:space:]]*//p" | head -n1 \
    | sed -e "s/^[\"']//" -e "s/[\"']\$//" -e 's/[[:space:]]*$//'
}
status=$(get status)
by=$(get signed_by)
on=$(get signed_on)
problems=""
if [ "$status" != "signed" ]; then problems="$problems status is '$status' (need signed);"; fi
case "$by" in ""|null|"~") problems="$problems signed_by is empty;" ;; esac
if ! printf '%s' "$on" | grep -Eq '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'; then
  problems="$problems signed_on is '$on' (need YYYY-MM-DD);"
fi

if [ -n "$problems" ]; then
  echo "FAIL require-signed-design: $d:$problems"
  exit 1
fi
echo "PASS require-signed-design: $d signed by $by on $on"
