#!/usr/bin/env bash
# Usage: scripts/ci/check-versions.sh [package.json]. Fails on ^ ~ > < latest * or x ranges in dependencies and devDependencies,
# and when pnpm-lock.yaml (next to package.json) is missing or resolves any specifier to "latest".
# Why: version policy pins every npm package exact (standards/versions.md). Enforced by: this script in CI.
set -euo pipefail
f="${1:-package.json}"
if [ ! -f "$f" ]; then echo "FAIL check-versions: $f not found"; exit 1; fi

bad=$(node -e '
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const out = [];
for (const section of ["dependencies", "devDependencies"]) {
  for (const [name, ver] of Object.entries(pkg[section] || {})) {
    const v = String(ver).trim();
    const loose = /^[\^~><]/.test(v) || v === "latest" || v === "*" || v === "" ||
      /(^|\.)x($|\.)/i.test(v) || /\s-\s/.test(v) || v.indexOf("||") >= 0;
    if (loose) out.push("  " + section + ": " + name + " " + v);
  }
}
process.stdout.write(out.join("\n"));
' "$f")

lock="$(dirname "$f")/pnpm-lock.yaml"
if [ ! -f "$lock" ]; then
  bad="$bad${bad:+
}  lockfile: $lock not found. Run pnpm install and commit it."
elif grep -Eq ":[[:space:]]*[\"']?latest[\"']?[[:space:]]*$" "$lock"; then
  bad="$bad${bad:+
}  lockfile: $lock has a 'latest' specifier. Pin it in package.json and run pnpm install."
fi

if [ -n "$bad" ]; then
  n=$(printf '%s\n' "$bad" | wc -l | tr -d ' ')
  echo "FAIL check-versions: $n problem(s). Pin each version exact and commit pnpm-lock.yaml."
  printf '%s\n' "$bad"
  exit 1
fi
echo "PASS check-versions: all dependencies pinned exact, pnpm-lock.yaml present"
