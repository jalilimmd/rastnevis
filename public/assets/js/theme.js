/* Applies the saved theme before first paint (kept external so the CSP needs no inline script). */
(function () {
  try {
    var p = JSON.parse(localStorage.getItem('rastnevis.prefs.v1') || '{}');
    if (p.theme === 'light' || p.theme === 'dark') document.documentElement.setAttribute('data-theme', p.theme);
  } catch (e) { /* storage unavailable */ }
})();
