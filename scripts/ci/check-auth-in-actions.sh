#!/usr/bin/env bash
# Usage: scripts/ci/check-auth-in-actions.sh. Every src/app/**/actions.ts(x), route.ts(x) and 'use server' module must call requirePermission(.
# Why: page checks do not cover actions. Public routes still call requirePermission(session, 'public'). Comment lines do not count.
set -euo pipefail
if [ ! -d src/app ]; then echo "PASS check-auth-in-actions: no src/app folder"; exit 0; fi

files=$( { find src/app -type f \( -name 'actions.ts' -o -name 'actions.tsx' -o -name 'route.ts' -o -name 'route.tsx' \)
  grep -rlE --include='*.ts' --include='*.tsx' "^['\"]use server['\"]" src/app 2>/dev/null || true; } | sort -u)
bad=""
total=0
while IFS= read -r f; do
  [ -n "$f" ] || continue
  total=$((total + 1))
  if ! grep -Ev '^[[:space:]]*(//|\*|/\*)' "$f" | grep -q 'requirePermission('; then
    bad="$bad  $f
"
  fi
done <<EOF2
$files
EOF2

if [ -n "$bad" ]; then
  n=$(printf '%s' "$bad" | wc -l | tr -d ' ')
  echo "FAIL check-auth-in-actions: $n of $total file(s) never call requirePermission("
  printf '%s' "$bad"
  exit 1
fi
echo "PASS check-auth-in-actions: $total file(s) call requirePermission("
