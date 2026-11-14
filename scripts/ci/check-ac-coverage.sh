#!/usr/bin/env bash
# Usage: scripts/ci/check-ac-coverage.sh. Every ID like E-012/AC-03 in work/*/epic.md must appear in some file under tests/.
# Why: one test per EARS line. Runs at release (run-all.sh --release). Stories land one by one, so PR CI only warns.
set -euo pipefail
pat='E-[0-9]{3}/AC-[0-9]{2}'
epics=$(find work -mindepth 2 -maxdepth 2 -name epic.md 2>/dev/null | sort || true)
if [ -z "$epics" ]; then echo "PASS check-ac-coverage: no work/*/epic.md files"; exit 0; fi

ids=$(printf '%s\n' "$epics" | while IFS= read -r e; do grep -ohE "$pat" "$e" || true; done | sort -u)
if [ -z "$ids" ]; then echo "PASS check-ac-coverage: no AC ids in epics"; exit 0; fi

found=""
if [ -d tests ]; then found=$(grep -rhoE "${pat}[0-9]*" tests 2>/dev/null | sort -u || true); fi
# A test that names E-012/AC-010 must not count for E-012/AC-01: match whole ids only.
found=$(printf '%s\n' "$found" | grep -E "^$pat\$" || true)
missing=$(comm -23 <(printf '%s\n' "$ids") <(printf '%s\n' "$found"))
total=$(printf '%s\n' "$ids" | wc -l | tr -d ' ')

if [ -n "$missing" ]; then
  n=$(printf '%s\n' "$missing" | wc -l | tr -d ' ')
  echo "FAIL check-ac-coverage: $n of $total AC id(s) not found under tests/"
  printf '%s\n' "$missing" | sed 's/^/  /'
  exit 1
fi
echo "PASS check-ac-coverage: all $total AC id(s) appear under tests/"
