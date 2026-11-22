#!/usr/bin/env bash
# Pre-deploy checks for public/: every referenced local file exists, the
# service worker precache list is valid, and the page makes no third-party requests.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUB="$ROOT/public"
fail=0

err() { echo "ERROR: $*" >&2; fail=1; }

# 1. Local files referenced from index.html (src/href) and app.css (url()).
refs="$(
  { grep -oE '(src|href)="[^"#]+"' "$PUB/index.html" | sed -E 's/^(src|href)="//; s/"$//'
    grep -oE 'url\("[^"]+"\)' "$PUB/assets/css/app.css" | sed -E 's/^url\("//; s/"\)$//; s#^\.\./#assets/#'
  } | grep -vE '^(https?:|data:|mailto:|//)' || true
)"
while IFS= read -r ref; do
  [ -z "$ref" ] && continue
  [ -e "$PUB/$ref" ] || err "missing file referenced by the site: $ref"
done <<< "$refs"

# 2. Service worker precache entries.
while IFS= read -r entry; do
  path="${entry#./}"
  [ -z "$path" ] && continue
  [ -e "$PUB/$path" ] || err "sw.js precaches a missing file: $entry"
done < <(grep -oE "'\./[^']*'" "$PUB/sw.js" | tr -d "'")

# 3. No third-party requests from the page itself.
if grep -nE '(src|href)="https?://' "$PUB/index.html"; then
  err "index.html loads a third-party resource; self-host it in public/"
fi

# 4. Manifest is valid JSON.
if command -v python3 >/dev/null 2>&1; then
  python3 -m json.tool "$PUB/manifest.webmanifest" >/dev/null || err "manifest.webmanifest is not valid JSON"
fi

if [ "$fail" -ne 0 ]; then
  echo "Checks failed." >&2
  exit 1
fi
echo "All checks passed."
