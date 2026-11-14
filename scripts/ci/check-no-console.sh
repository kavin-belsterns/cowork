#!/usr/bin/env bash
# Usage: scripts/ci/check-no-console.sh. Fails on console. in src/ except src/lib/logger.ts. Comment lines are ignored.
# Enforced rule: standards/logging.md (one JSON logger, nothing else writes to stdout).
set -euo pipefail
if [ ! -d src ]; then echo "PASS check-no-console: no src/ folder"; exit 0; fi

hits=$(grep -rnE '(^|[^A-Za-z0-9_.])console\.' src \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs' 2>/dev/null \
  | grep -v '^src/lib/logger\.ts:' \
  | grep -Ev ':[0-9]+:[[:space:]]*(//|\*|/\*)' || true)

if [ -n "$hits" ]; then
  n=$(printf '%s\n' "$hits" | wc -l | tr -d ' ')
  echo "FAIL check-no-console: $n console call(s). Use src/lib/logger.ts."
  printf '%s\n' "$hits" | cut -c1-120 | sed 's/^/  /'
  exit 1
fi
echo "PASS check-no-console: no console calls outside logger"
