/* OceanBazar Lite — ES5 progressive enhancement (no frameworks) */
(function () {
  'use strict';

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  // Mobile menu
  var menuBtn = qs('#menuBtn');
  var drawer = qs('#navDrawer');
  if (menuBtn && drawer) {
    menuBtn.addEventListener('click', function () {
      var open = !drawer.hasAttribute('hidden');
      if (open) {
        drawer.setAttribute('hidden', 'hidden');
        menuBtn.setAttribute('aria-expanded', 'false');
      } else {
        drawer.removeAttribute('hidden');
        menuBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  // Quantity steppers
  qsa('[data-qty]').forEach(function (wrap) {
    var input = qs('input[name="quantity"]', wrap) || qs('input[type="number"]', wrap);
    if (!input) return;
    var dec = qs('[data-qty-dec]', wrap);
    var inc = qs('[data-qty-inc]', wrap);
    if (dec) {
      dec.addEventListener('click', function () {
        var n = parseInt(input.value, 10) || 1;
        input.value = Math.max(1, n - 1);
      });
    }
    if (inc) {
      inc.addEventListener('click', function () {
        var n = parseInt(input.value, 10) || 1;
        var max = parseInt(input.getAttribute('max'), 10) || 99;
        input.value = Math.min(max, n + 1);
      });
    }
  });

  // Product gallery thumbs
  qsa('[data-gallery]').forEach(function (gallery) {
    var main = qs('#galleryMain', gallery) || qs('.gallery-main img', gallery);
    if (!main) return;
    qsa('.thumb', gallery).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var src = btn.getAttribute('data-src');
        if (!src) return;
        main.src = src;
        qsa('.thumb', gallery).forEach(function (b) {
          if (b === btn) b.className = 'thumb active';
          else b.className = 'thumb';
        });
      });
    });
  });

  // Flash countdown
  qsa('[data-countdown]').forEach(function (el) {
    var remaining = parseInt(el.getAttribute('data-countdown'), 10) || 0;
    var label = el.getAttribute('data-label') || '';
    if (remaining <= 0) return;
    var end = Date.now() + remaining;
    function pad(n) {
      return n < 10 ? '0' + n : String(n);
    }
    function tick() {
      var ms = end - Date.now();
      if (ms <= 0) {
        el.textContent = label + ' 00:00:00';
        return;
      }
      var total = Math.floor(ms / 1000);
      var h = Math.floor(total / 3600);
      var m = Math.floor((total % 3600) / 60);
      var s = total % 60;
      el.textContent = label + ' ' + pad(h) + ':' + pad(m) + ':' + pad(s);
      setTimeout(tick, 1000);
    }
    tick();
  });

  // Ajax add-to-cart (falls back to normal form submit)
  qsa('form[data-ajax-cart]').forEach(function (form) {
    form.addEventListener('submit', function (ev) {
      // buy-now should navigate
      var submitter = ev.submitter || document.activeElement;
      if (submitter && submitter.name === 'buyNow') return;

      if (!window.XMLHttpRequest) return;
      ev.preventDefault();
      var xhr = new XMLHttpRequest();
      xhr.open('POST', form.action, true);
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) return;
        if (xhr.status >= 200 && xhr.status < 400) {
          var badge = qs('.cart-link .badge');
          if (!badge) {
            var link = qs('.cart-link');
            if (link) {
              badge = document.createElement('span');
              badge.className = 'badge';
              badge.textContent = '1';
              link.appendChild(badge);
            }
          } else {
            var n = parseInt(badge.textContent, 10) || 0;
            badge.textContent = String(n + 1);
          }
          var btn = qs('button[type="submit"]', form);
          if (btn) {
            var prev = btn.textContent;
            btn.textContent = '✓';
            setTimeout(function () { btn.textContent = prev; }, 1200);
          }
        } else {
          form.submit();
        }
      };
      xhr.onerror = function () { form.submit(); };
      xhr.send(new FormData(form));
    });
  });
})();
