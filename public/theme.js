// Storefront font per product. Reads the product's font choice and applies it on the landing page.
(function () {
  var FONTS = {
    manrope: { display: 'Manrope', body: 'DM Sans' },
    poppins: { display: 'Poppins', body: 'Poppins' },
    playfair: { display: 'Playfair Display', body: 'Inter' },
    space: { display: 'Space Grotesk', body: 'Inter' },
    montserrat: { display: 'Montserrat', body: 'Montserrat' }
  };
  function apply(theme) {
    var f = FONTS[theme] || FONTS.manrope;
    var names = [f.display, f.body].filter(function (v, i, a) { return a.indexOf(v) === i; });
    var href = 'https://fonts.googleapis.com/css2?' + names.map(function (n) {
      return 'family=' + n.replace(/ /g, '+') + ':wght@400;500;600;700;800';
    }).join('&') + '&display=swap';
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    var s = document.documentElement.style;
    s.setProperty('--display', "'" + f.display + "', system-ui, sans-serif");
    s.setProperty('--body', "'" + f.body + "', system-ui, sans-serif");
  }
  var q = new URLSearchParams(location.search);
  if (q.get('preview') === '1') {
    try { apply((JSON.parse(localStorage.getItem('eboora-preview-config') || '{}')).fontTheme); } catch (e) { apply('manrope'); }
    return;
  }
  var m = location.pathname.match(/^\/p\/([^\/]+)\/?$/);
  var slug = q.get('slug') || (m ? decodeURIComponent(m[1]) : '');
  if (!slug) { apply('manrope'); return; }
  fetch('/api/products/' + encodeURIComponent(slug), { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (p) { apply(p && p.fontTheme); })
    .catch(function () { apply('manrope'); });
})();
