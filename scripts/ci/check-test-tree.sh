#!/usr/bin/env bash
# Usage: scripts/ci/check-test-tree.sh. Fails on *.test.* or *.spec.* files under src/. Tests live in tests/ only.
# Enforced rule: standards/testing.md (one tests/ tree, no test files under src/).
set -euo pipefail
if [ ! -d src ]; then echo "PASS check-test-tree: no src/ folder"; exit 0; fi

bad=$(find src -type f \( -name '*.test.*' -o -name '*.spec.*' \) | sort)
if [ -n "$bad" ]; then
  n=$(printf '%s\n' "$bad" | wc -l | tr -d ' ')
  echo "FAIL check-test-tree: $n test file(s) under src/. Move them to tests/."
  printf '%s\n' "$bad" | sed 's/^/  /'
  exit 1
fi
echo "PASS check-test-tree: no test files under src/"
