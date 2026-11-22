# Security and performance review: Rastnevis web app

Reviewed 2026-11-22. Scope: `public/` (static site), deploy configs, `scripts/`, GitHub Actions.

**Verdict:** the design was already sound: static, no backend, everything self-hosted, strict CSP, sanitized rendering. The one serious gap was an outdated HTML sanitizer with published XSS advisories. That and the other fixable items below are fixed. The remaining items are low-risk trade-offs, listed with recommendations.

## Fixed

| # | Severity | Finding | Impact | Fix |
|---|---|---|---|---|
| S1 | High | DOMPurify 3.1.6 had 20+ published advisories, several of them XSS bypasses in the default configuration (e.g. GHSA-v8jm-5vwx-cfxm, GHSA-v2wj-7wpq-c8vv, GHSA-h8r8-wccr-v5f2). | A crafted Markdown file or paste could run script in the page and read saved drafts. | Upgraded to DOMPurify 3.4.17, which has no known advisories. XSS probes (`onerror`, `javascript:` links, `<svg><script>`) were blocked in testing. |
| S2 | Medium | Exported and copied HTML linked to Google Fonts. | Opening an exported file sent the reader's IP to Google, and fonts failed where Google is blocked (e.g. Iran). | Exports now embed the site's own woff2 fonts as data URIs. No third-party requests from the page or its exports. |
| S3 | Medium | Vendored minified libraries could be changed in a commit without anyone noticing. | Supply-chain tampering would be hard to review. | `scripts/vendor.sha256` records every vendored file; `scripts/check.sh` fails the deploy on any mismatch or unlisted file. |
| S4 | Medium | GitHub Actions were referenced by movable tags (`@v7`). | A compromised action tag could change what runs in the deploy job. | Pinned to commit SHAs, `persist-credentials: false`, Dependabot opens weekly update PRs. |
| P1 | Perf | highlight.js (~120 KB) loaded on every visit. | Slower first load on mobile. | Loaded only when the document has a fenced code block with a language. |
| P2 | Perf | Every keystroke re-highlighted every code block. | Typing slowed down in code-heavy documents. | Highlighting is cached per (language, code); blocks over 60 000 characters are left plain. |
| P3 | Perf | Fixed 80 ms render delay and 350 ms save delay at any size. | Typing in large documents could stutter, since saves are synchronous. | Render delay scales 80 / 200 / 450 ms and save delay 0.4 / 1.2 / 2.5 s by size. Drafts are flushed on `pagehide` and when the tab is hidden, so nothing is lost. |

Measured after the fixes (headless Chrome): one main-thread task of about **130 ms per edit** for a 45 KB document with 400 code blocks, and about **430 ms** for 170 KB with 1 500 code blocks.

## Accepted (low risk), with recommendations

| # | Finding | Why accepted | Recommendation |
|---|---|---|---|
| A1 | `img-src https:` lets Markdown images load from any site. | Needed for images in documents. A tracking image only reveals the IP of whoever previews that text. | Optional: a setting to block remote images. |
| A2 | GitHub Pages cannot send response headers, so there is no `frame-ancestors` / `X-Frame-Options` there. | The page has no account or sensitive action to clickjack. | Host on Netlify, Cloudflare Pages or Vercel to get the full header set from `_headers` / `vercel.json`. |
| A3 | `style-src-attr 'unsafe-inline'`. | Needed for style attributes in user HTML and for formatted copy. CSS can't run script, and it only affects the user's own view. | None. |
| A4 | Drafts are kept in `localStorage` in plain text. | That's what makes auto-save work. The data stays on the device. | On shared computers, use **پاک کردن** before leaving. |
| A5 | `nginx.conf` sets no HSTS header. | TLS normally ends at a proxy or CDN in front of the container. | Add `Strict-Transport-Security` where TLS terminates. |
| A6 | Very large documents (>200 KB) re-render fully on each edit. | Typical documents render in well under 150 ms. | If needed later: render only changed blocks, or parse in a Web Worker. |

## Verified as correct

- No backend, no secrets, no analytics, no cookies. Text never leaves the browser.
- CSP: `script-src 'self'` (no inline scripts, no `eval`), `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`, `connect-src 'self'`.
- All rendered Markdown goes through DOMPurify with `<style>` forbidden. External links get `rel="noopener noreferrer"`.
- Service worker caches only same-origin GET responses and registers only over HTTPS.
- Docker image runs nginx as a non-root user, with security headers and long-term caching only for versioned files.

## Not run

**DAST (HawkScan):** not run, because this environment has neither the `hawk` CLI nor a StackHawk API key. For a static site it would mainly check response headers. To run it: install `hawk` 6+, set `HAWK_API_KEY`, then `hawk scan` against the deployed URL.

## Keeping it secure

1. Merge Dependabot PRs for GitHub Actions.
2. Update vendored libraries with `scripts/update-vendor.sh` (it rewrites the checksums), run `scripts/check.sh`, and bump `CACHE_VERSION` in `public/sw.js`.
3. Check advisories now and then: `npm audit` in a scratch folder with `marked`, `dompurify` and `highlight.js` at the vendored versions.
