/*! Rastnevis (راست‌نویس) | MIT License | Markdown editor with full right-to-left preview */
'use strict';

(() => {
  const $ = (s) => document.querySelector(s);
  const root = document.documentElement;

  const ed = $('#editor');
  const pv = $('#preview');
  const pvScroll = $('#preview-scroll');
  const ws = $('#workspace');
  const dropZone = $('#drop-zone');
  const fileInput = $('#file-input');
  const splitter = $('#splitter');

  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const nf = (() => { try { return new Intl.NumberFormat('fa-IR'); } catch (e) { return null; } })();
  const fa = (n) => (nf ? nf.format(n) : String(n).replace(/\d/g, (d) => FA[d]));
  const BLOCKS = 'p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,dt,dd,figcaption,summary,caption';

  /* ---------- storage (per-viewer convenience only) ---------- */
  const KEY_DOC = 'rastnevis.doc.v1';
  const KEY_PREFS = 'rastnevis.prefs.v1';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  };
  const parse = (s) => { try { return JSON.parse(s) || {}; } catch (e) { return {}; } };
  const prefs = Object.assign({ pvDir: 'rtl', edDir: 'rtl', digits: false, size: 16, split: 0.5, theme: 'system' }, parse(store.get(KEY_PREFS)));
  const savePrefs = () => store.set(KEY_PREFS, JSON.stringify(prefs));

  const SAMPLE = $('#sample').textContent.replace(/^\n/, '');

  /* ---------- libraries ---------- */
  const libsOk = !!(window.marked && window.DOMPurify);
  if (window.marked) marked.use({ gfm: true, breaks: false });
  if (window.hljs) hljs.configure({ ignoreUnescapedHTML: true });

  const EMPTY_HTML =
    '<div class="empty">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12h6M9 15.5h6"/></svg>' +
    '<p class="empty-title">متنی برای نمایش نیست</p>' +
    '<p>متن Markdown را در ویرایشگر بنویسید یا یک فایل <code dir="ltr">.md</code> را روی آن رها کنید.</p>' +
    '</div>';

  /* ---------- rendering ---------- */
  function render() {
    const src = ed.value;
    if (!src.trim()) {
      pv.innerHTML = EMPTY_HTML;
      pv.dataset.empty = '1';
      updateStats();
      return;
    }
    delete pv.dataset.empty;
    if (!libsOk) {
      pv.innerHTML = '<div class="empty"><p class="empty-title">پیش‌نمایش بارگذاری نشد</p><p>کتابخانهٔ Markdown دریافت نشد. اتصال اینترنت را بررسی کنید و صفحه را دوباره باز کنید.</p></div>';
      return;
    }
    let html = '';
    try { html = marked.parse(src); } catch (e) { html = '<p>خطا در خواندن Markdown.</p>'; }
    pv.innerHTML = DOMPurify.sanitize(html, { FORBID_TAGS: ['style'] });
    decorate(pv);
    updateStats();
  }

  function decorate(el) {
    el.querySelectorAll('a[href]').forEach((a) => {
      const h = a.getAttribute('href') || '';
      if (/^(https?:)?\/\//i.test(h)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    });

    el.querySelectorAll('img').forEach((img) => {
      img.loading = 'lazy';
      img.decoding = 'async';
      img.referrerPolicy = 'no-referrer';
    });

    el.querySelectorAll('table').forEach((t) => {
      if (t.parentElement && t.parentElement.classList.contains('table-wrap')) return;
      const w = document.createElement('div');
      w.className = 'table-wrap';
      t.before(w);
      w.append(t);
    });

    el.querySelectorAll('li input[type="checkbox"]').forEach((cb) => {
      const li = cb.closest('li');
      if (!li) return;
      li.classList.add('task');
      if (li.parentElement) li.parentElement.classList.add('task-list');
    });

    el.querySelectorAll('pre').forEach((pre) => {
      const code = pre.querySelector('code');
      pre.setAttribute('dir', 'ltr');
      let lang = '';
      if (code) {
        const m = (code.className || '').match(/language-([\w+#.-]+)/);
        if (m) lang = m[1].toLowerCase();
      }
      if (code && window.hljs && lang && hljs.getLanguage(lang)) {
        try { hljs.highlightElement(code); } catch (e) { /* keep plain */ }
      }
      const fig = document.createElement('figure');
      fig.className = 'codeblock';
      const head = document.createElement('div');
      head.className = 'cb-head';
      const label = document.createElement('span');
      label.className = 'cb-lang';
      label.setAttribute('dir', 'ltr');
      label.textContent = lang || 'code';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cb-copy';
      btn.textContent = 'کپی کد';
      head.append(label, btn);
      pre.before(fig);
      fig.append(head, pre);
    });

    // Inline code keeps its own direction as an isolated run, so neighbouring punctuation can't jump around it.
    el.querySelectorAll('code, kbd, samp').forEach((c) => {
      if (!c.closest('pre')) c.setAttribute('dir', 'auto');
    });

    if (prefs.pvDir === 'rtl') {
      // Full RTL: every block inherits rtl from the root; drop any per-block direction.
      el.querySelectorAll('[dir]').forEach((n) => {
        if (n.closest('pre') || n.matches('code, kbd, samp, .cb-lang')) return;
        n.removeAttribute('dir');
      });
    } else {
      el.querySelectorAll(BLOCKS).forEach((b) => b.setAttribute('dir', 'auto'));
    }

    if (prefs.digits) persianDigits(el);
  }

  function faToken(tok) {
    if (/[A-Za-z_]/.test(tok) || !/\d/.test(tok)) return tok;
    let t = tok;
    if ((t.match(/\./g) || []).length === 1) t = t.replace(/(\d)\.(?=\d)/, '$1٫');
    return t.replace(/%/g, '٪').replace(/\d/g, (d) => FA[d]);
  }
  function persianDigits(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.parentElement.closest('pre, code, kbd, samp, .cb-head')
          ? NodeFilter.FILTER_REJECT
          : /\d/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => { n.nodeValue = n.nodeValue.replace(/[A-Za-z0-9_\-.:\/%]+/g, faToken); });
  }

  /* ---------- stats & saving ---------- */
  function visibleText() {
    let out = '';
    const walker = document.createTreeWalker(pv, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement.closest('.cb-head') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    while (walker.nextNode()) out += walker.currentNode.nodeValue + ' ';
    return out;
  }
  function updateStats() {
    const text = pv.dataset.empty ? '' : visibleText();
    const words = (text.match(/[\p{L}\p{N}_‌‍']+/gu) || []).length;
    const chars = ed.value.length;
    const minutes = words ? Math.max(1, Math.ceil(words / 200)) : 0;
    $('#stats').textContent = `${fa(words)} واژه، ${fa(chars)} نویسه، ${fa(minutes)} دقیقه مطالعه`;
  }
  let saveTimer;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const ok = store.set(KEY_DOC, ed.value);
      $('#save-state').textContent = ok ? 'در همین مرورگر ذخیره شد' : 'ذخیرهٔ خودکار در این مرورگر در دسترس نیست';
    }, 350);
  }
  let renderTimer;
  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => { render(); syncScroll(); }, 80);
  }
  ed.addEventListener('input', () => { scheduleRender(); scheduleSave(); });

  /* ---------- scroll sync (editor → preview) ---------- */
  function syncScroll() {
    const max = ed.scrollHeight - ed.clientHeight;
    const r = max > 0 ? ed.scrollTop / max : 0;
    pvScroll.scrollTop = r * (pvScroll.scrollHeight - pvScroll.clientHeight);
  }
  ed.addEventListener('scroll', syncScroll, { passive: true });

  /* ---------- editing helpers (keep native undo where possible) ---------- */
  function insertText(t) {
    ed.focus();
    let ok = false;
    try { ok = t === '' ? document.execCommand('delete') : document.execCommand('insertText', false, t); } catch (e) { ok = false; }
    if (!ok) {
      ed.setRangeText(t, ed.selectionStart, ed.selectionEnd, 'end');
      ed.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  function setAll(t) {
    ed.focus();
    ed.select();
    if (!ed.value && !t) return;
    insertText(t);
    ed.setSelectionRange(0, 0);
    ed.scrollTop = 0;
  }
  function wrap(before, after, placeholder) {
    const v = ed.value, s = ed.selectionStart, e = ed.selectionEnd;
    const sel = v.slice(s, e);
    if (sel && v.slice(s - before.length, s) === before && v.slice(e, e + after.length) === after) {
      ed.setSelectionRange(s - before.length, e + after.length);
      insertText(sel);
      ed.setSelectionRange(s - before.length, s - before.length + sel.length);
      return;
    }
    const body = sel || placeholder;
    insertText(before + body + after);
    ed.setSelectionRange(s + before.length, s + before.length + body.length);
  }
  function mapLines(fn) {
    const v = ed.value, s = ed.selectionStart;
    let e = ed.selectionEnd;
    if (e > s && v[e - 1] === '\n') e -= 1;
    const ls = v.lastIndexOf('\n', s - 1) + 1;
    let le = v.indexOf('\n', e);
    if (le < 0) le = v.length;
    const lines = v.slice(ls, le).split('\n');
    const out = fn(lines).join('\n');
    ed.setSelectionRange(ls, le);
    insertText(out);
    if (lines.length === 1) ed.setSelectionRange(ls + out.length, ls + out.length);
    else ed.setSelectionRange(ls, ls + out.length);
  }
  function togglePrefix(re, make) {
    mapLines((lines) => {
      const filled = lines.filter((l) => l.trim());
      const all = filled.length > 0 && filled.every((l) => re.test(l));
      let n = 0;
      return lines.map((l) => {
        if (!l.trim() && lines.length > 1) return l;
        return all ? l.replace(re, '') : make(n++) + l.replace(re, '');
      });
    });
  }
  function ensureOwnLine(text) {
    const v = ed.value, s = ed.selectionStart;
    const lead = s === 0 ? '' : v[s - 1] === '\n' ? (v[s - 2] === '\n' || s < 2 ? '' : '\n') : '\n\n';
    return lead + text;
  }
  const TABLE_TPL = '| ستون ۱ | ستون ۲ |\n|---|---|\n| مقدار | مقدار |\n';

  const CMDS = {
    bold: () => wrap('**', '**', 'متن پررنگ'),
    italic: () => wrap('*', '*', 'متن تأکیدی'),
    code: () => wrap('`', '`', 'code'),
    heading: () => mapLines((lines) => lines.map((l) => {
      if (/^###\s/.test(l)) return l.replace(/^###\s+/, '');
      if (/^#{1,2}\s/.test(l)) return '#' + l;
      return '## ' + l;
    })),
    ul: () => togglePrefix(/^\s*[-*+]\s+(\[[ xX]\]\s+)?/, () => '- '),
    ol: () => togglePrefix(/^\s*\d+[.)]\s+/, (i) => `${i + 1}. `),
    quote: () => togglePrefix(/^>\s?/, () => '> '),
    codeblock: () => {
      const s = ed.selectionStart, sel = ed.value.slice(s, ed.selectionEnd) || 'code';
      const block = ensureOwnLine('```\n' + sel + '\n```\n');
      const start = s + block.indexOf('```\n') + 4;
      insertText(block);
      ed.setSelectionRange(start, start + sel.length);
    },
    link: () => {
      const s = ed.selectionStart, sel = ed.value.slice(s, ed.selectionEnd) || 'متن پیوند';
      insertText(`[${sel}](https://)`);
      const u = s + sel.length + 3;
      ed.setSelectionRange(u, u + 8);
    },
    table: () => {
      const s = ed.selectionStart;
      const block = ensureOwnLine(TABLE_TPL);
      insertText(block);
      const p = s + block.length;
      ed.setSelectionRange(p, p);
    },
    zwnj: () => insertText('‌'),
  };
  document.querySelectorAll('[data-cmd]').forEach((b) => {
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => CMDS[b.dataset.cmd]());
  });

  ed.addEventListener('keydown', (e) => {
    if (e.key === ' ' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      insertText('‌');
      return;
    }
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const map = { KeyB: 'bold', KeyI: 'italic', KeyK: 'link' };
    const cmd = map[e.code];
    if (cmd) { e.preventDefault(); CMDS[cmd](); }
  });

  /* ---------- toast ---------- */
  const toastEl = $('#toast');
  let toastTimer;
  function hideToast() {
    toastEl.classList.remove('show');
    setTimeout(() => { if (!toastEl.classList.contains('show')) toastEl.hidden = true; }, 200);
  }
  function toast(msg, action) {
    toastEl.replaceChildren();
    const m = document.createElement('span');
    if (typeof msg === 'string') m.textContent = msg; else m.append(...msg);
    toastEl.append(m);
    if (action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'toast-act';
      b.textContent = action.label;
      b.addEventListener('click', () => { action.run(); hideToast(); });
      toastEl.append(b);
    }
    toastEl.hidden = false;
    requestAnimationFrame(() => toastEl.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, action ? 6500 : 2800);
  }
  const bdi = (t) => { const b = document.createElement('bdi'); b.textContent = t; return b; };
  const undoTo = (prev) => (prev.trim() ? { label: 'بازگردانی', run: () => setAll(prev) } : null);

  /* ---------- file actions ---------- */
  function loadFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('این فایل بزرگ‌تر از ۵ مگابایت است.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const prev = ed.value;
      setAll(String(reader.result || '').replace(/^﻿/, ''));
      toast(['فایل باز شد: ', bdi(file.name)], undoTo(prev));
    };
    reader.onerror = () => toast('خواندن فایل ممکن نشد.');
    reader.readAsText(file, 'utf-8');
  }
  $('#btn-open').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => { loadFile(fileInput.files[0]); fileInput.value = ''; });

  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  dropZone.addEventListener('dragover', (e) => { if (!hasFiles(e)) return; e.preventDefault(); dropZone.classList.add('dragging'); });
  dropZone.addEventListener('dragleave', (e) => { if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('dragging'); });
  dropZone.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dropZone.classList.remove('dragging');
    loadFile(e.dataTransfer.files[0]);
  });

  $('#btn-sample').addEventListener('click', () => {
    const prev = ed.value;
    if (prev === SAMPLE) return;
    setAll(SAMPLE);
    toast('متن نمونه بارگذاری شد.', undoTo(prev));
  });
  $('#btn-clear').addEventListener('click', () => {
    const prev = ed.value;
    if (!prev) return;
    setAll('');
    toast('متن پاک شد.', undoTo(prev));
  });
  $('#btn-fix').addEventListener('click', () => {
    let count = 0;
    const parts = ed.value.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g);
    const out = parts.map((part, i) => (i % 2 ? part : part.replace(/[يىك٠-٩]/g, (ch) => {
      count++;
      if (ch === 'ك') return 'ک';
      if (ch === 'ي' || ch === 'ى') return 'ی';
      return FA[ch.charCodeAt(0) - 0x660];
    }))).join('');
    if (!count) { toast('نویسهٔ عربی پیدا نشد.'); return; }
    const pos = ed.selectionStart, top = ed.scrollTop;
    ed.select();
    insertText(out);
    ed.setSelectionRange(pos, pos);
    ed.scrollTop = top;
    toast(`${fa(count)} نویسه به شکل فارسی اصلاح شد.`);
  });

  /* ---------- copy ---------- */
  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
  async function copyPlain(text, okMsg) {
    try { await navigator.clipboard.writeText(text); toast(okMsg); }
    catch (e) { toast(legacyCopy(text) ? okMsg : 'کپی ممکن نشد. متن را دستی انتخاب و کپی کنید.'); }
  }

  function exportClone() {
    const c = pv.cloneNode(true);
    c.querySelectorAll('.cb-head').forEach((n) => n.remove());
    c.querySelectorAll('figure.codeblock').forEach((f) => { const pre = f.querySelector('pre'); if (pre) f.replaceWith(pre); });
    c.querySelectorAll('.table-wrap').forEach((w) => { if (w.firstElementChild) w.replaceWith(w.firstElementChild); });
    if (prefs.pvDir === 'rtl') c.querySelectorAll(BLOCKS + ',table,ul,ol').forEach((b) => b.setAttribute('dir', 'rtl'));
    return c;
  }
  function richHtml() {
    const c = exportClone();
    const rtl = prefs.pvDir === 'rtl';
    if (rtl) c.querySelectorAll(BLOCKS).forEach((b) => { b.style.textAlign = 'right'; });
    c.querySelectorAll('pre').forEach((p) => {
      p.setAttribute('dir', 'ltr');
      p.style.cssText = 'direction:ltr;text-align:left;font-family:Consolas,Menlo,monospace;font-size:13px;background:#f1f5f5;border:1px solid #d9e2e2;padding:10px 12px;white-space:pre-wrap;';
    });
    c.querySelectorAll('code').forEach((k) => {
      if (!k.closest('pre')) k.style.cssText = 'font-family:Consolas,Menlo,monospace;background:#eef3f3;padding:0 3px;border-radius:3px;';
    });
    c.querySelectorAll('table').forEach((t) => { t.style.borderCollapse = 'collapse'; });
    c.querySelectorAll('th,td').forEach((x) => { x.style.border = '1px solid #c9d4d4'; x.style.padding = '4px 8px'; });
    c.querySelectorAll('blockquote').forEach((q) => { q.style.cssText = 'margin:0 0 1em;padding:4px 12px;border-right:3px solid #0d7a79;background:#f2f8f7;'; });
    return `<div dir="rtl" lang="fa" style="direction:rtl;text-align:right;font-family:Vazirmatn,Tahoma,sans-serif;line-height:1.8;">${c.innerHTML}</div>`;
  }
  async function copyRich() {
    if (pv.dataset.empty) { toast('متنی برای کپی نیست.'); return; }
    const html = richHtml();
    try {
      if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) throw new Error('no-rich');
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([ed.value], { type: 'text/plain' }),
      })]);
      toast('متن قالب‌دار کپی شد؛ در Word یا ایمیل جای‌گذاری کنید.');
    } catch (e) {
      const box = document.createElement('div');
      box.innerHTML = html;
      box.style.cssText = 'position:fixed;top:0;left:-10000px;';
      document.body.append(box);
      const r = document.createRange();
      r.selectNodeContents(box);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      sel.removeAllRanges();
      box.remove();
      toast(ok ? 'متن قالب‌دار کپی شد.' : 'کپی ممکن نشد. متن پیش‌نمایش را انتخاب کنید و Ctrl+C بزنید.');
    }
  }
  const esc = (s) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const EXPORT_CSS = [
    'body{margin:0;background:#fff;color:#172224;font-family:Vazirmatn,Tahoma,sans-serif}',
    '.md{max-width:46rem;margin:0 auto;padding:40px 20px 64px;font-size:17px;line-height:1.95;text-align:start}',
    '.md h1,.md h2,.md h3,.md h4{line-height:1.45;margin:1.6em 0 .55em}',
    '.md h1{font-size:1.8em;font-weight:800;margin-top:0}.md h2{font-size:1.38em;padding-bottom:.35em;border-bottom:1px solid #d9e2e2}.md h3{font-size:1.16em}',
    '.md p,.md ul,.md ol,.md blockquote,.md table,.md pre{margin:0 0 1em}',
    '.md ul,.md ol{padding-inline-start:1.55em}.md li::marker{color:#0d7a79}',
    '.md a{color:#0d7a79;text-underline-offset:4px}',
    '.md em{font-style:normal;background:linear-gradient(transparent 58%,#cfeceb 0)}',
    '.md blockquote{border-inline-start:3px solid #0d7a79;background:#f2f8f7;padding:.65em 1.05em}',
    '.md code{font-family:"JetBrains Mono",Vazirmatn,monospace;font-size:.84em;background:#f1f5f5;border:1px solid #d9e2e2;border-radius:5px;padding:.08em .38em}',
    '.md pre{direction:ltr;text-align:left;background:#f1f5f5;border:1px solid #d9e2e2;border-radius:8px;padding:.9em 1.05em;overflow-x:auto;line-height:1.75}',
    '.md pre code{background:none;border:0;padding:0}',
    '.md table{border-collapse:collapse;width:100%}.md th,.md td{border-bottom:1px solid #d9e2e2;padding:.5em .9em;text-align:start}.md th{background:#f5f8f8}',
    '.md hr{border:0;height:1px;background:#d9e2e2;margin:2.2em 0}.md img{max-width:100%}',
    '.md ul.task-list{list-style:none;padding-inline-start:.15em}.md li.task input{margin:0;margin-inline-end:.55em}',
    '.hljs-keyword,.hljs-literal,.hljs-section{color:#2149a8}.hljs-string,.hljs-regexp{color:#9a4b12}.hljs-number{color:#a8285f}.hljs-comment{color:#74878a}.hljs-title,.hljs-name{color:#0b6a85}.hljs-attr,.hljs-variable,.hljs-type{color:#6340b8}.hljs-built_in,.hljs-meta{color:#0d7a79}',
  ].join('\n');
  function standaloneHtml() {
    const c = exportClone();
    const h1 = c.querySelector('h1');
    const title = (h1 ? h1.textContent : 'سند').trim() || 'سند';
    const css = EXPORT_CSS + (prefs.digits ? '\n.md ol{list-style-type:persian}' : '');
    return '<!doctype html>\n<html lang="fa" dir="rtl">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      `<title>${esc(title)}</title>\n` +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700;800&family=JetBrains+Mono:wght@400;500&display=swap">\n' +
      `<style>\n${css}\n</style>\n</head>\n<body>\n<article class="md">\n${c.innerHTML}\n</article>\n</body>\n</html>\n`;
  }
  $('#copy-rich').addEventListener('click', copyRich);
  function baseName() {
    const h = pv.querySelector('h1');
    const t = (h ? h.textContent : '')
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60)
      .trim();
    return t || 'rastnevis';
  }
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function downloadMarkdown() {
    if (!ed.value.trim()) { toast('متنی برای ذخیره نیست.'); return; }
    const name = baseName() + '.md';
    download(name, ed.value, 'text/markdown;charset=utf-8');
    toast(['ذخیره شد: ', bdi(name)]);
  }
  const exportMenu = $('#export-menu');
  const EXPORTS = {
    md: downloadMarkdown,
    html: () => {
      if (pv.dataset.empty) { toast('متنی برای ذخیره نیست.'); return; }
      const name = baseName() + '.html';
      download(name, standaloneHtml(), 'text/html;charset=utf-8');
      toast(['ذخیره شد: ', bdi(name)]);
    },
    'copy-html': () => {
      if (pv.dataset.empty) { toast('متنی برای کپی نیست.'); return; }
      copyPlain(standaloneHtml(), 'سند HTML کامل کپی شد.');
    },
    print: () => {
      if (pv.dataset.empty) { toast('متنی برای چاپ نیست.'); return; }
      render();
      window.print();
    },
  };
  exportMenu.querySelectorAll('[data-export]').forEach((b) => b.addEventListener('click', () => {
    exportMenu.open = false;
    EXPORTS[b.dataset.export]();
  }));
  document.addEventListener('click', (e) => { if (exportMenu.open && !exportMenu.contains(e.target)) exportMenu.open = false; });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && exportMenu.open) { exportMenu.open = false; exportMenu.querySelector('summary').focus(); }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === 'KeyS') { e.preventDefault(); downloadMarkdown(); }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === 'KeyP') { e.preventDefault(); EXPORTS.print(); }
  });
  pv.addEventListener('click', (e) => {
    const b = e.target.closest('.cb-copy');
    if (!b) return;
    const code = b.closest('.codeblock').querySelector('pre');
    copyPlain(code ? code.textContent : '', 'کد کپی شد.');
  });

  /* ---------- view options ---------- */
  const themeBtn = $('#theme-btn');
  const THEME_LABEL = { system: 'پوسته: هماهنگ با سیستم', light: 'پوسته: روشن', dark: 'پوسته: تیره' };
  function applyTheme() {
    if (prefs.theme === 'light' || prefs.theme === 'dark') root.setAttribute('data-theme', prefs.theme);
    else root.removeAttribute('data-theme');
    themeBtn.dataset.mode = prefs.theme;
    themeBtn.title = THEME_LABEL[prefs.theme] || THEME_LABEL.system;
    themeBtn.setAttribute('aria-label', themeBtn.title);
  }
  themeBtn.addEventListener('click', () => {
    const order = ['system', 'light', 'dark'];
    prefs.theme = order[(order.indexOf(prefs.theme) + 1) % order.length];
    savePrefs();
    applyTheme();
    toast(THEME_LABEL[prefs.theme]);
  });

  function applyPrefs() {
    applyTheme();
    document.querySelectorAll('[data-pvdir]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pvdir === prefs.pvDir)));
    document.querySelectorAll('[data-eddir]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.eddir === prefs.edDir)));
    ed.dataset.dir = prefs.edDir;
    pv.dataset.digits = prefs.digits ? 'on' : 'off';
    $('#opt-digits').checked = !!prefs.digits;
    pv.style.setProperty('--pv-size', prefs.size + 'px');
    $('#font-val').textContent = fa(prefs.size);
    applySplit();
  }
  document.querySelectorAll('[data-pvdir]').forEach((b) => b.addEventListener('click', () => {
    prefs.pvDir = b.dataset.pvdir; savePrefs(); applyPrefs(); render();
  }));
  document.querySelectorAll('[data-eddir]').forEach((b) => b.addEventListener('click', () => {
    prefs.edDir = b.dataset.eddir; savePrefs(); applyPrefs();
  }));
  $('#opt-digits').addEventListener('change', (e) => { prefs.digits = e.target.checked; savePrefs(); applyPrefs(); render(); });
  const setSize = (d) => { prefs.size = Math.min(24, Math.max(13, prefs.size + d)); savePrefs(); applyPrefs(); };
  $('#font-dec').addEventListener('click', () => setSize(-1));
  $('#font-inc').addEventListener('click', () => setSize(1));

  /* ---------- tabs (narrow screens) ---------- */
  function setView(v) {
    ws.dataset.view = v;
    $('#tab-edit').setAttribute('aria-selected', String(v === 'edit'));
    $('#tab-preview').setAttribute('aria-selected', String(v === 'preview'));
  }
  $('#tab-edit').addEventListener('click', () => setView('edit'));
  $('#tab-preview').addEventListener('click', () => setView('preview'));

  /* ---------- splitter ---------- */
  function applySplit() {
    const r = Math.min(0.8, Math.max(0.2, Number(prefs.split) || 0.5));
    ws.style.setProperty('--ed-fr', r + 'fr');
    ws.style.setProperty('--pv-fr', (1 - r) + 'fr');
    splitter.setAttribute('aria-valuenow', String(Math.round(r * 100)));
  }
  const isRTL = () => getComputedStyle(ws).direction === 'rtl';
  splitter.addEventListener('pointerdown', (e) => {
    splitter.setPointerCapture(e.pointerId);
    splitter.classList.add('dragging');
    document.body.classList.add('resizing');
  });
  splitter.addEventListener('pointermove', (e) => {
    if (!splitter.hasPointerCapture(e.pointerId)) return;
    const r = ws.getBoundingClientRect();
    const x = isRTL() ? (r.right - e.clientX) / r.width : (e.clientX - r.left) / r.width;
    prefs.split = Math.min(0.8, Math.max(0.2, x));
    applySplit();
  });
  const endDrag = (e) => {
    if (splitter.hasPointerCapture && splitter.hasPointerCapture(e.pointerId)) splitter.releasePointerCapture(e.pointerId);
    splitter.classList.remove('dragging');
    document.body.classList.remove('resizing');
    savePrefs();
  };
  splitter.addEventListener('pointerup', endDrag);
  splitter.addEventListener('pointercancel', endDrag);
  splitter.addEventListener('keydown', (e) => {
    const step = 0.04;
    let d = 0;
    if (e.key === 'ArrowLeft') d = isRTL() ? step : -step;
    if (e.key === 'ArrowRight') d = isRTL() ? -step : step;
    if (!d) return;
    e.preventDefault();
    prefs.split = Math.min(0.8, Math.max(0.2, prefs.split + d));
    applySplit();
    savePrefs();
  });

  /* ---------- boot ---------- */
  const saved = store.get(KEY_DOC);
  ed.value = saved === null ? SAMPLE : saved;
  $('#save-state').textContent = saved === null ? 'متن نمونه' : 'از آخرین نشست بازیابی شد';
  applyPrefs();
  render();

  /* ---------- offline support (HTTPS only, so local http testing never caches) ---------- */
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* offline mode is optional */ });
    });
  }
})();
