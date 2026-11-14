#!/usr/bin/env bash
# Usage: scripts/ci/check-fk-index.sh [prisma/schema.prisma]. Every @relation(fields: [x]) needs @@index, @unique or @id on x in the same model.
# Why: Postgres does not index foreign keys. Enforced rule: standards/data.md (index every FK). One-line @relation only.
set -euo pipefail
f="${1:-prisma/schema.prisma}"
if [ ! -f "$f" ]; then echo "PASS check-fk-index: no $f, nothing to check"; exit 0; fi

missing=$(awk '
function norm(s) { gsub(/\([^)]*\)/, "", s); gsub(/[][ \t]/, "", s); return s }
function covered(list,    n, m, a, b, i, j, k, ok, hit) {
  n = split(list, a, ",")
  for (i = 1; i <= nidx; i++) {
    m = split(idx[i], b, ",")
    if (m < n) continue
    ok = 1
    for (k = 1; k <= n; k++) {          # first n index columns must be the FK columns
      hit = 0
      for (j = 1; j <= n; j++) if (a[j] == b[k]) hit = 1
      if (!hit) ok = 0
    }
    if (ok) return 1
  }
  return 0
}
/^[ \t]*\/\// { next }
/^[ \t]*model[ \t]+[A-Za-z0-9_]+[ \t]*\{/ { inm = 1; name = $2; nidx = 0; nrel = 0; next }
inm && /^[ \t]*\}/ {
  for (i = 1; i <= nrel; i++)
    if (!covered(rel[i])) print "  " name ": fields [" rel[i] "] need @@index([" rel[i] "])"
  inm = 0; next
}
inm {
  if (match($0, /fields:[ \t]*\[[^]]*\]/)) {
    s = substr($0, RSTART, RLENGTH); sub(/^fields:[ \t]*/, "", s); rel[++nrel] = norm(s)
  }
  if ($0 ~ /^[ \t]*@@(index|unique|id)\(/ && match($0, /\[[^]]*\]/))
    idx[++nidx] = norm(substr($0, RSTART, RLENGTH))
  else if ($1 !~ /^@/ && ($0 ~ /[ \t]@unique/ || $0 ~ /[ \t]@id([ \t(]|$)/))
    idx[++nidx] = $1
}
' "$f")

if [ -n "$missing" ]; then
  n=$(printf '%s\n' "$missing" | wc -l | tr -d ' ')
  echo "FAIL check-fk-index: $n foreign key(s) without an index"
  printf '%s\n' "$missing"
  exit 1
fi
echo "PASS check-fk-index: every foreign key has an index"
