/* v77: site-wide motion. Click ripple, page fade in/out, scroll reveal. Respects reduced-motion settings. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var css = [
    '::selection{background:transparent;color:inherit}',
    'body.eb-in{animation:eb-fade .5s cubic-bezier(.2,.7,.2,1) both}',
    'body.eb-leave{opacity:0;transition:opacity .22s ease}',
    '@keyframes eb-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    '.eb-ripple{position:absolute;border-radius:50%;background:rgba(255,255,255,.38);transform:scale(0);opacity:.9;pointer-events:none;animation:eb-ripple .65s ease-out forwards}',
    '@keyframes eb-ripple{to{transform:scale(1);opacity:0}}',
    '.eb-reveal{opacity:0;transform:translateY(16px);transition:opacity .6s ease,transform .6s cubic-bezier(.2,.7,.2,1)}',
    '.eb-reveal.eb-show{opacity:1;transform:none}',
    'a,button,.btn{transition:transform .18s ease,box-shadow .18s ease,background-color .18s ease,color .18s ease}',
    'a:active,button:active,.btn:active{transform:scale(.97)}',
    '@media (hover:hover){.btn:hover{transform:translateY(-1px)}}',
    '@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}.eb-reveal{opacity:1!important;transform:none!important}}'
  ].join('');
  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // page entry
  document.body.classList.add('eb-in');

  // ripple on every tap or click
  if (!reduce) {
    document.addEventListener('pointerdown', function (e) {
      var t = e.target.closest && e.target.closest('a,button,.btn,.item,.chips li,.coupon-apply,.quick-view');
      if (!t || t.disabled) return;
      var r = t.getBoundingClientRect();
      var size = Math.max(r.width, r.height) * 2;
      var s = document.createElement('span');
      s.className = 'eb-ripple';
      s.style.width = s.style.height = size + 'px';
      s.style.left = (e.clientX - r.left - size / 2) + 'px';
      s.style.top = (e.clientY - r.top - size / 2) + 'px';
      if (getComputedStyle(t).position === 'static') t.style.position = 'relative';
      if (getComputedStyle(t).overflow === 'visible') t.style.overflow = 'hidden';
      t.appendChild(s);
      setTimeout(function () { s.remove(); }, 700);
    }, { passive: true });
  }

  // smooth fade before moving to another page of this site
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download') || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    var u = new URL(a.href, location.href);
    if (u.origin !== location.origin) return;
    if (u.hash && u.pathname === location.pathname) return;
    e.preventDefault();
    document.body.classList.add('eb-leave');
    setTimeout(function () { location.href = a.href; }, reduce ? 0 : 200);
  });

  // reveal sections and cards as they scroll into view
  function reveal() {
    var items = document.querySelectorAll('section:not(.hero):not(.lp-hero), .item, .lp-grid > *, .promises > div, .foot, .lp-footer');
    if (!items.length) return;
    if (!('IntersectionObserver' in window) || reduce) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('eb-show'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { el.classList.add('eb-reveal'); io.observe(el); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', reveal); else reveal();
})();
