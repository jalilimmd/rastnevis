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
    grep -oE "'(vendor|assets)/[^']+\.(js|woff2)'" "$PUB/assets/js/app.js" | tr -d "'"
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

# 4. Vendored libraries and fonts match their recorded checksums.
SUMS="$ROOT/scripts/vendor.sha256"
if [ -f "$SUMS" ]; then
  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$PUB" && sha256sum -c "$SUMS" >/dev/null) || err "vendored files do not match scripts/vendor.sha256"
  elif command -v shasum >/dev/null 2>&1; then
    (cd "$PUB" && shasum -a 256 -s -c "$SUMS") || err "vendored files do not match scripts/vendor.sha256"
  fi
  # Every vendored file must be listed.
  for f in "$PUB"/vendor/*.min.js "$PUB"/assets/fonts/*.woff2; do
    rel="${f#"$PUB"/}"
    grep -q " $rel\$\| \*$rel\$" "$SUMS" || err "not in scripts/vendor.sha256: $rel"
  done
else
  err "scripts/vendor.sha256 is missing; run scripts/update-vendor.sh"
fi

# 5. Manifest is valid JSON.
if command -v python3 >/dev/null 2>&1; then
  python3 -m json.tool "$PUB/manifest.webmanifest" >/dev/null || err "manifest.webmanifest is not valid JSON"
fi

if [ "$fail" -ne 0 ]; then
  echo "Checks failed." >&2
  exit 1
fi
echo "All checks passed."
