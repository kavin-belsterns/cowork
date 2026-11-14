#!/usr/bin/env bash
# Usage: scripts/ci/check-dashes.sh. Fails on an em dash or en dash in markdown under docs/ and work/.
# Enforced rule: standards/writing.md (use commas or full stops).
set -euo pipefail
em=$(printf '\342\200\224')
en=$(printf '\342\200\223')
dirs=""
for d in docs work; do
  if [ -d "$d" ]; then dirs="$dirs $d"; fi
done
if [ -z "$dirs" ]; then echo "PASS check-dashes: no docs/ or work/ folder"; exit 0; fi

# shellcheck disable=SC2086
hits=$(grep -rnF --include='*.md' -e "$em" -e "$en" $dirs 2>/dev/null | cut -d: -f1,2 || true)
if [ -n "$hits" ]; then
  n=$(printf '%s\n' "$hits" | wc -l | tr -d ' ')
  echo "FAIL check-dashes: $n line(s) with an em or en dash"
  printf '%s\n' "$hits" | sed 's/^/  /'
  exit 1
fi
echo "PASS check-dashes: no em or en dashes in docs/ and work/"
