// Text can be selected only after a 2.5 second press-and-hold, so it is not copied by accident.
(function () {
  var HOLD = 2500, timer = null;
  function enable() { document.documentElement.classList.add('allow-select'); }
  function disable() { document.documentElement.classList.remove('allow-select'); }
  document.addEventListener('pointerdown', function (e) {
    if (e.target.closest && e.target.closest('input,textarea,select,button,a')) return;
    clearTimeout(timer); timer = setTimeout(enable, HOLD);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
    document.addEventListener(ev, function () { clearTimeout(timer); disable(); });
  });
  document.addEventListener('contextmenu', function (e) {
    if (!(e.target.closest && e.target.closest('input,textarea'))) e.preventDefault();
  });
})();
