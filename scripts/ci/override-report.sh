#!/usr/bin/env bash
# Usage: scripts/ci/override-report.sh [adr folder]. Counts ADRs with type: override per rule. Prints REVIEW: for a rule at 3 or more.
# Why: standards/overrides.md (a rule skipped three times gets reviewed). Informational, always exits 0.
set -euo pipefail
dir="${1:-docs/adr}"
if [ ! -d "$dir" ]; then echo "INFO override-report: no $dir folder, 0 overrides"; exit 0; fi

# One line per override ADR: rule <TAB> work_item <TAB> file. Front matter only, quotes and trailing spaces removed.
rows=$(for f in "$dir"/*.md; do
  [ -f "$f" ] || continue
  tr -d '\r' < "$f" | awk -v file="$f" -v q="'" '
    /^---[[:space:]]*$/ { n++; if (n == 2) exit; next }
    n == 1 && /^[a-z_]+:/ { k = $0; sub(/:.*/, "", k); v = $0; sub(/^[^:]*:[[:space:]]*/, "", v)
      gsub(/"/, "", v); gsub(q, "", v); sub(/[[:space:]]+$/, "", v); fm[k] = v }
    END { if (fm["type"] == "override") printf "%s\t%s\t%s\n", (fm["rule"] == "" ? "(no rule)" : fm["rule"]), fm["work_item"], file }'
done | sort)

if [ -z "$rows" ]; then echo "INFO override-report: 0 overrides in $dir"; exit 0; fi
total=$(printf '%s\n' "$rows" | wc -l | tr -d ' ')
counts=$(printf '%s\n' "$rows" | cut -f1 | uniq -c | awk '{ c = $1; $1 = ""; sub(/^ /, ""); print c "\t" $0 }')
rules=$(printf '%s\n' "$counts" | wc -l | tr -d ' ')
hot=$(printf '%s\n' "$counts" | awk -F'\t' '$1 >= 3' | wc -l | tr -d ' ')

echo "INFO override-report: $total override(s) on $rules rule(s), $hot rule(s) at 3 or more"
printf '%s\n' "$counts" | awk -F'\t' '{ printf "  %-40s %s\n", $2, $1 }'
printf '%s\n' "$rows" | awk -F'\t' '{ printf "    %s  %s  %s\n", $1, $2, $3 }'
printf '%s\n' "$counts" | awk -F'\t' '$1 >= 3 { print "REVIEW: " $2 " overridden " $1 " times" }'
exit 0
