# Rastnevis (راست‌نویس)

<div dir="rtl">

**راست‌نویس** ویرایشگر Markdown با پیش‌نمایش راست‌چین کامل برای متن فارسی است. سطرهایی که با واژهٔ انگلیسی، برچسب پررنگ لاتین یا کد شروع می‌شوند هم راست‌چین می‌مانند. همه‌چیز در مرورگر اجرا می‌شود و متن شما به هیچ سروری فرستاده نمی‌شود.

</div>

A Markdown editor with a live preview that keeps Persian text fully right-to-left. It is a static site: no build step, no backend, no third-party requests.

## Purpose

Most Markdown previewers pick each paragraph's direction from its first letter (`dir="auto"` or `unicode-bidi: plaintext`). A Persian line that starts with `DBeaver`, `**RDS:**` or `` `e0ad005` `` then flips to LTR, punctuation jumps to the wrong end, and parentheses around code break.

Rastnevis fixes this:

- The preview root is `dir="rtl"` and per-block `dir` attributes are removed (full RTL mode).
- Inline `code`, `kbd` and `samp` are isolated with `dir="auto"`, so nearby punctuation stays put.
- Code blocks are forced to `dir="ltr"`.
- Lists, quotes and tables use logical CSS properties, so they mirror correctly.

## Features

- Live GFM preview: tables, task lists, fenced code with syntax highlighting.
- Direction modes: **راست‌چین کامل** (default) or **خودکار** (per-paragraph, for comparison).
- **ارقام فارسی**: shows ۰–۹ in prose (code untouched) and Persian list numbers.
- **اصلاح ی و ک**: converts Arabic ي/ك/ى and Arabic-Indic digits to Persian forms, outside code.
- Formatting toolbar and `Shift+Space` for نیم‌فاصله (ZWNJ).
- Open or drag-and-drop `.md`/`.txt` files.
- Export: download `.md` or standalone `.html`, copy rich text (keeps RTL in Word, Gmail, Outlook), copy HTML, print or save as PDF.
- Light, dark and system themes; resizable panes; mobile tabs.
- Installable PWA that works offline once loaded over HTTPS.
- Draft and settings auto-saved in the browser (`localStorage`).

## Structure

```
rastnevis/
├── public/                     # The deployable site (publish this folder)
│   ├── index.html              # Markup, CSP meta tag, social tags
│   ├── assets/
│   │   ├── css/app.css         # Styles, theme tokens, print styles, @font-face
│   │   ├── js/app.js           # Editor, rendering pipeline, export, PWA registration
│   │   ├── js/theme.js         # Applies saved theme before first paint
│   │   ├── fonts/              # Vazirmatn + JetBrains Mono (woff2, OFL)
│   │   └── icons/              # Favicons, PWA icons, og-image.png
│   ├── vendor/                 # marked, DOMPurify, highlight.js (+ licenses/)
│   ├── sw.js                   # Service worker (network-first, offline fallback)
│   ├── manifest.webmanifest    # PWA manifest
│   ├── _headers                # Security + cache headers (Netlify, Cloudflare Pages)
│   ├── robots.txt
│   └── .nojekyll
├── .github/workflows/pages.yml # GitHub Pages deploy
├── .gitlab-ci.yml              # GitLab Pages deploy
├── netlify.toml                # Netlify
├── vercel.json                 # Vercel (output dir + headers)
├── Dockerfile, nginx.conf      # Self-hosting with nginx (non-root, port 8080)
├── scripts/check.sh            # Pre-deploy checks (also run in CI)
├── scripts/update-vendor.sh    # Refresh libraries and fonts from npm
├── LICENSE
└── THIRD_PARTY_NOTICES.md
```

All paths in the site are relative, so it works at a domain root (`example.com/`) and under a sub-path (`user.github.io/rastnevis/`).

## Setup / requirements

- To run or deploy: nothing to install. Any static file server works.
- To refresh vendored libraries: `npm` and `bash`.
- To use the Docker image: Docker.

Run locally:

```bash
python3 -m http.server 8080 -d public
# open http://localhost:8080
```

The service worker registers only over HTTPS, so local testing is never cached.

## Deploy

Run the checks first:

```bash
bash scripts/check.sh
```

Create the repo:

```bash
git init -b main
git add .
git commit -m "Initial release"
git remote add origin https://github.com/<you>/rastnevis.git
git push -u origin main
```

### GitHub Pages

1. Push to `main`.
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The `Deploy to GitHub Pages` workflow publishes `public/`. The URL appears in the workflow run.

GitHub Pages cannot set response headers, so the CSP comes from the `<meta>` tag in `index.html` (it cannot set `frame-ancestors`).

### GitLab Pages

Push to the default branch. `.gitlab-ci.yml` runs the checks and publishes `public/`.

### Netlify

Import the repo (or drag the `public/` folder into Netlify Drop). `netlify.toml` sets `publish = "public"`; headers come from `public/_headers`.

### Cloudflare Pages

Connect the repo with **Framework preset: None**, **Build command:** empty, **Build output directory:** `public`. Headers come from `public/_headers`.

Without Git: `npx wrangler pages deploy public`.

### Vercel

Import the repo with **Framework preset: Other**. `vercel.json` sets the output directory and headers. CLI: `npx vercel --prod`.

### Docker / any server

```bash
docker build -t rastnevis .
docker run -d -p 8080:8080 --name rastnevis rastnevis
```

The image runs nginx as a non-root user with the same headers. On an existing nginx host, reuse `nginx.conf` and point `root` at the `public/` folder. For Apache, S3, or any other static host, upload the contents of `public/` and add the headers from `public/_headers` where the host allows it.

### After the first deploy

- Social previews need absolute URLs: in `index.html`, change `og:image` to `https://<your-domain>/assets/icons/og-image.png` and add `<meta property="og:url" content="https://<your-domain>/">`.
- For a custom domain, follow your host's domain settings (GitHub Pages: **Settings → Pages → Custom domain**).

## Usage

1. Type or paste Markdown, open a file, or drop one onto the editor.
2. Pick the preview direction and options in the preview toolbar.
3. Use **کپی قالب‌دار** for Word or email, or **خروجی** to download `.md`/`.html`, copy HTML, or print.

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd+B` | Bold |
| `Ctrl/Cmd+I` | Emphasis |
| `Ctrl/Cmd+K` | Link |
| `Ctrl/Cmd+S` | Download `.md` |
| `Ctrl/Cmd+P` | Print or save as PDF |
| `Shift+Space` | Insert ZWNJ (نیم‌فاصله) |

Shortcuts use physical key codes, so they also work with a Persian keyboard layout.

## Security and privacy

- No backend and no analytics. Text stays in the browser.
- Everything is self-hosted: no Google Fonts or CDN requests. This also keeps the site working where those services are blocked or slow.
- Rendered HTML is sanitized with DOMPurify; `<style>` tags are stripped and external links open with `rel="noopener noreferrer"`.
- Content Security Policy: scripts, styles, fonts and workers from the same origin only. Images may load from any HTTPS URL so Markdown images work. Hosts that support headers (Netlify, Cloudflare Pages, Vercel, nginx) also send `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` and COOP.
- The CSP is defined in four places; keep them identical: `public/index.html`, `public/_headers`, `vercel.json`, `nginx.conf`.

## Maintenance

**Update libraries or fonts**

```bash
MARKED=12.0.2 DOMPURIFY=3.1.6 HLJS=11.9.0 bash scripts/update-vendor.sh
bash scripts/check.sh
```

The script downloads pinned packages from npm, writes versioned file names, and updates references in `index.html`, `sw.js` and `app.css`.

**Release**

Bump `CACHE_VERSION` in `public/sw.js` on every release so installed PWAs drop old cached files. The service worker is network-first, so online visitors always get the latest deploy.

## License

MIT, see [LICENSE](LICENSE). Bundled libraries and fonts keep their own licenses, listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
