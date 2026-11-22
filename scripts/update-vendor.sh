#!/usr/bin/env bash
# Refresh the self-hosted libraries and fonts in public/ from npm.
# Usage: scripts/update-vendor.sh            (uses the pinned versions below)
#        MARKED=12.0.3 scripts/update-vendor.sh   (override one version)
# Requires: npm, tar. No node_modules are left behind.
set -euo pipefail

MARKED="${MARKED:-12.0.2}"
DOMPURIFY="${DOMPURIFY:-3.4.17}"
HLJS="${HLJS:-11.9.0}"
VAZIRMATN="${VAZIRMATN:-33.0.3}"
JBMONO="${JBMONO:-5.3.0}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUB="$ROOT/public"
VENDOR="$PUB/vendor"
FONTS="$PUB/assets/fonts"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Fetching packages..."
(
  cd "$TMP"
  npm pack --silent \
    "marked@$MARKED" \
    "dompurify@$DOMPURIFY" \
    "@highlightjs/cdn-assets@$HLJS" \
    "vazirmatn@$VAZIRMATN" \
    "@fontsource-variable/jetbrains-mono@$JBMONO" >/dev/null
  for f in *.tgz; do
    mkdir -p "${f%.tgz}"
    tar -xzf "$f" -C "${f%.tgz}"
  done
)

pkg() { echo "$TMP/$1/package"; }
MARKED_DIR="$(pkg "marked-$MARKED")"
PURIFY_DIR="$(pkg "dompurify-$DOMPURIFY")"
HLJS_DIR="$(pkg "highlightjs-cdn-assets-$HLJS")"
VAZIR_DIR="$(pkg "vazirmatn-$VAZIRMATN")"
JB_DIR="$(pkg "fontsource-variable-jetbrains-mono-$JBMONO")"

mkdir -p "$VENDOR/licenses" "$FONTS"

# Remove previous versions so only the pinned ones ship.
rm -f "$VENDOR"/marked-*.min.js "$VENDOR"/purify-*.min.js "$VENDOR"/highlight-*.min.js
rm -f "$FONTS"/Vazirmatn-*-wght.woff2 "$FONTS"/JetBrainsMono-*-latin-wght.woff2

cp "$MARKED_DIR/marked.min.js"              "$VENDOR/marked-$MARKED.min.js"
cp "$PURIFY_DIR/dist/purify.min.js"         "$VENDOR/purify-$DOMPURIFY.min.js"
cp "$HLJS_DIR/highlight.min.js"             "$VENDOR/highlight-$HLJS.min.js"
cp "$MARKED_DIR/LICENSE.md"                 "$VENDOR/licenses/marked.LICENSE.md"
cp "$PURIFY_DIR/LICENSE"                    "$VENDOR/licenses/dompurify.LICENSE.txt"
cp "$HLJS_DIR/LICENSE"                      "$VENDOR/licenses/highlightjs.LICENSE.txt"

cp "$VAZIR_DIR/fonts/webfonts/Vazirmatn[wght].woff2"             "$FONTS/Vazirmatn-$VAZIRMATN-wght.woff2"
cp "$JB_DIR/files/jetbrains-mono-latin-wght-normal.woff2"        "$FONTS/JetBrainsMono-$JBMONO-latin-wght.woff2"
cp "$VAZIR_DIR/OFL.txt"                                          "$FONTS/OFL-Vazirmatn.txt"
cp "$JB_DIR/LICENSE"                                             "$FONTS/OFL-JetBrainsMono.txt"

# Point every reference at the new file names.
for f in "$PUB/index.html" "$PUB/sw.js" "$PUB/assets/css/app.css" "$PUB/assets/js/app.js"; do
  [ -f "$f" ] || continue
  sed -i.bak -E \
    -e "s#marked-[0-9][0-9A-Za-z.-]*\.min\.js#marked-$MARKED.min.js#g" \
    -e "s#purify-[0-9][0-9A-Za-z.-]*\.min\.js#purify-$DOMPURIFY.min.js#g" \
    -e "s#highlight-[0-9][0-9A-Za-z.-]*\.min\.js#highlight-$HLJS.min.js#g" \
    -e "s#Vazirmatn-[0-9][0-9A-Za-z.-]*-wght\.woff2#Vazirmatn-$VAZIRMATN-wght.woff2#g" \
    -e "s#JetBrainsMono-[0-9][0-9A-Za-z.-]*-latin-wght\.woff2#JetBrainsMono-$JBMONO-latin-wght.woff2#g" \
    "$f"
  rm -f "$f.bak"
done

# Record checksums so scripts/check.sh can detect any later change to vendored files.
(
  cd "$PUB"
  sha256sum vendor/*.min.js assets/fonts/*.woff2 > "$ROOT/scripts/vendor.sha256" 2>/dev/null ||
    shasum -a 256 vendor/*.min.js assets/fonts/*.woff2 > "$ROOT/scripts/vendor.sha256"
)

echo "Done:"
echo "  marked $MARKED, DOMPurify $DOMPURIFY, highlight.js $HLJS"
echo "  Vazirmatn $VAZIRMATN, JetBrains Mono $JBMONO"
echo "Checksums written to scripts/vendor.sha256."
echo "Next: bump CACHE_VERSION in public/sw.js, then run scripts/check.sh"
