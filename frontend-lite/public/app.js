/* OceanBazar Lite — ES5 progressive enhancement (no frameworks) */
(function () {
  'use strict';

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }


  // Premium slide-over menu (ES5, no frameworks)
  (function initNavDrawer() {
    var menuBtn = qs('#menuBtn');
    var drawer = qs('#navDrawer');
    var backdrop = qs('#navBackdrop');
    if (!menuBtn || !drawer) return;

    function isOpen() {
      return !drawer.hasAttribute('hidden');
    }
    function setOpen(open) {
      if (open) {
        drawer.removeAttribute('hidden');
        drawer.className = String(drawer.className || '').replace(/\bis-open\b/g, '').replace(/\s+/g, ' ').trim() + ' is-open';
        if (backdrop) backdrop.removeAttribute('hidden');
        menuBtn.setAttribute('aria-expanded', 'true');
        if (document.body.className.indexOf('nav-open') === -1) {
          document.body.className = (document.body.className + ' nav-open').replace(/\s+/g, ' ').trim();
        }
      } else {
        drawer.setAttribute('hidden', 'hidden');
        drawer.className = String(drawer.className || '').replace(/\bis-open\b/g, '').replace(/\s+/g, ' ').trim();
        if (backdrop) backdrop.setAttribute('hidden', 'hidden');
        menuBtn.setAttribute('aria-expanded', 'false');
        document.body.className = String(document.body.className || '').replace(/\bnav-open\b/g, '').replace(/\s+/g, ' ').trim();
      }
    }

    menuBtn.addEventListener('click', function () {
      setOpen(!isOpen());
    });
    qsa('[data-nav-close]').forEach(function (el) {
      el.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.keyCode === 27 && isOpen()) setOpen(false);
    });
  })();

  // Quantity steppers (respect max attribute = retail/wholesale/flash caps)
  qsa('[data-qty]').forEach(function (wrap) {
    var input = qs('input[name="quantity"]', wrap) || qs('input[type="number"]', wrap);
    if (!input) return;
    var dec = qs('[data-qty-dec]', wrap);
    var inc = qs('[data-qty-inc]', wrap);
    function clamp(n) {
      var max = parseInt(input.getAttribute('max'), 10);
      if (!isFinite(max) || max < 1) max = 99;
      var min = parseInt(input.getAttribute('min'), 10);
      if (!isFinite(min) || min < 1) min = 1;
      return Math.min(max, Math.max(min, n));
    }
    function emit() {
      try {
        var ev = document.createEvent('HTMLEvents');
        ev.initEvent('change', true, false);
        input.dispatchEvent(ev);
      } catch (e) {}
    }
    if (dec) {
      dec.addEventListener('click', function () {
        input.value = String(clamp((parseInt(input.value, 10) || 1) - 1));
        emit();
      });
    }
    if (inc) {
      inc.addEventListener('click', function () {
        input.value = String(clamp((parseInt(input.value, 10) || 1) + 1));
        emit();
      });
    }
    input.addEventListener('change', function () {
      input.value = String(clamp(parseInt(input.value, 10) || 1));
    });
  });

  // Product gallery thumbs + prev/next
  qsa('[data-gallery]').forEach(function (gallery) {
    var main = qs('#galleryMain', gallery) || qs('.gallery-main img', gallery);
    var mainVideo = qs('#galleryMainVideo', gallery);
    if (!main && !mainVideo) return;
    var thumbs = qsa('.thumb', gallery);
    var idx = 0;
    function show(i) {
      if (!thumbs.length) return;
      idx = Math.max(0, Math.min(i, thumbs.length - 1));
      var btn = thumbs[idx];
      var src = btn.getAttribute('data-src');
      var type = btn.getAttribute('data-type') || 'image';
      if (type === 'video' && mainVideo) {
        if (main) main.style.display = 'none';
        mainVideo.style.display = 'block';
        mainVideo.src = src || '';
      } else {
        if (mainVideo) { mainVideo.pause(); mainVideo.style.display = 'none'; mainVideo.removeAttribute('src'); }
        if (main) {
          main.style.display = 'block';
          if (src) main.src = src;
        }
      }
      thumbs.forEach(function (b, j) {
        b.className = j === idx ? 'thumb active' : 'thumb';
      });
    }
    thumbs.forEach(function (btn, i) {
      btn.addEventListener('click', function () { show(i); });
    });
    var prev = qs('[data-gallery-prev]', gallery);
    var next = qs('[data-gallery-next]', gallery);
    if (prev) prev.addEventListener('click', function (e) { e.preventDefault(); show(idx - 1); });
    if (next) next.addEventListener('click', function (e) { e.preventDefault(); show(idx + 1); });

    // Option → media switch via colorKey on thumbs
    qsa('[data-option-media]').forEach(function (el) {
      el.addEventListener('change', function () {
        var key = el.getAttribute('data-option-media');
        var val = el.value;
        if (!key || !val) return;
        var slug = String(val).trim().toLowerCase().replace(/\s+/g, '-');
        var hit = -1;
        thumbs.forEach(function (b, i) {
          var ck = (b.getAttribute('data-color-key') || '').toLowerCase();
          if (hit < 0 && ck && ck === slug) hit = i;
        });
        if (hit >= 0) show(hit);
      });
      el.addEventListener('click', function () {
        // buttons for chip UIs
        var slug = (el.getAttribute('data-value-slug') || '').toLowerCase();
        if (!slug) return;
        var hit = -1;
        thumbs.forEach(function (b, i) {
          var ck = (b.getAttribute('data-color-key') || '').toLowerCase();
          if (hit < 0 && ck && ck === slug) hit = i;
        });
        if (hit >= 0) show(hit);
      });
    });
  });

  // Hero banner slider (fade + autoplay, ES5)
  qsa('[data-hero-slider]').forEach(function (root) {
    var slides = qsa('[data-hero-slide]', root);
    var dots = qsa('[data-hero-dot]', root);
    if (slides.length < 2) return;
    var idx = 0;
    var timer = null;
    var interval = parseInt(root.getAttribute('data-interval'), 10) || 5000;

    var defaultAnim = root.getAttribute('data-default-anim') || 'fade';

    function slideClass(slide, active) {
      var anim = slide.getAttribute('data-animation') || defaultAnim;
      anim = String(anim).replace(/[^a-z0-9-]/gi, '');
      return 'hero-slide hero-anim-' + anim + (active ? ' is-active' : '');
    }

    function currentInterval() {
      var slide = slides[idx];
      var ms = slide ? parseInt(slide.getAttribute('data-rotation-ms'), 10) : 0;
      return ms > 0 ? ms : interval;
    }

    function go(n) {
      idx = (n + slides.length) % slides.length;
      slides.forEach(function (slide, i) {
        if (i === idx) {
          slide.className = slideClass(slide, true);
          slide.removeAttribute('aria-hidden');
        } else {
          slide.className = slideClass(slide, false);
          slide.setAttribute('aria-hidden', 'true');
        }
      });
      dots.forEach(function (dot, i) {
        dot.className = i === idx ? 'hero-dot is-active' : 'hero-dot';
      });
    }

    function next() { go(idx + 1); }
    function prev() { go(idx - 1); }

    function start() {
      stop();
      timer = setTimeout(function () {
        next();
        start();
      }, currentInterval());
    }
    function stop() {
      if (timer) clearTimeout(timer);
      timer = null;
    }

    var prevBtn = qs('[data-hero-prev]', root);
    var nextBtn = qs('[data-hero-next]', root);
    if (prevBtn) prevBtn.addEventListener('click', function (e) { e.preventDefault(); prev(); start(); });
    if (nextBtn) nextBtn.addEventListener('click', function (e) { e.preventDefault(); next(); start(); });
    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        var n = parseInt(dot.getAttribute('data-hero-dot'), 10) || 0;
        go(n);
        start();
      });
    });

    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    start();
  });

  // Testimonials carousel (ES5)
  qsa('[data-testimonial-slider]').forEach(function (root) {
    var slides = qsa('[data-testimonial-slide]', root);
    var dots = qsa('[data-testimonial-dot]', root);
    if (slides.length < 2) return;
    var idx = 0;
    var timer = null;
    var interval = parseInt(root.getAttribute('data-interval'), 10) || 6000;
    if (interval < 2000) interval = 6000;

    function go(n) {
      idx = (n + slides.length) % slides.length;
      slides.forEach(function (slide, i) {
        if (i === idx) {
          slide.className = 'testimonial-slide is-active';
          slide.removeAttribute('aria-hidden');
        } else {
          slide.className = 'testimonial-slide';
          slide.setAttribute('aria-hidden', 'true');
        }
      });
      dots.forEach(function (dot, i) {
        dot.className = i === idx ? 'testimonials-dot is-active' : 'testimonials-dot';
      });
    }

    function start() {
      stop();
      timer = setInterval(function () { go(idx + 1); }, interval);
    }
    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        var n = parseInt(dot.getAttribute('data-testimonial-dot'), 10) || 0;
        go(n);
        start();
      });
    });

    start();
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

  // Encode form as application/x-www-form-urlencoded (Lite server has no multipart parser).
  // Previous FormData() posts left req.body empty → "Missing product".
  function encodeForm(form) {
    var parts = [];
    var els = form.elements;
    for (var i = 0; i < els.length; i += 1) {
      var el = els[i];
      if (!el.name || el.disabled) continue;
      var type = (el.type || '').toLowerCase();
      if (type === 'submit' || type === 'button' || type === 'file') continue;
      if ((type === 'checkbox' || type === 'radio') && !el.checked) continue;
      parts.push(encodeURIComponent(el.name) + '=' + encodeURIComponent(el.value == null ? '' : el.value));
    }
    return parts.join('&');
  }

  // Ajax add-to-cart (falls back to normal form submit)
  qsa('form[data-ajax-cart]').forEach(function (form) {
    form.addEventListener('submit', function (ev) {
      // buy-now should navigate
      var submitter = ev.submitter || document.activeElement;
      if (submitter && submitter.name === 'buyNow') return;

      if (!window.XMLHttpRequest) return;
      var body = encodeForm(form);
      if (body.indexOf('productId=') === -1) return; // let native submit try
      ev.preventDefault();
      var xhr = new XMLHttpRequest();
      xhr.open('POST', form.action, true);
      xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
      xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
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
          if (btn && btn.name !== 'buyNow') {
            var prev = btn.textContent;
            btn.textContent = '✓';
            setTimeout(function () { btn.textContent = prev; }, 1200);
          }
        } else {
          form.submit();
        }
      };
      xhr.onerror = function () { form.submit(); };
      xhr.send(body);
    });
  });

  // PDP pricing — mirrors live PricingBlock / calculatePrice (retail tiers, wholesale@MOQ, caps)
  function moneyBd(n) {
    var loc = (document.documentElement.getAttribute('lang') || 'en').indexOf('bn') === 0 ? 'bn-BD' : 'en-BD';
    return '৳' + Math.round(Number(n) || 0).toLocaleString(loc);
  }
  function round2(n) {
    return Math.round(Number(n) * 100) / 100;
  }
  function parseBands(pricing) {
    var raw = pricing && pricing.tierBands;
    if (!Array.isArray(raw) || !raw.length) {
      var out = [];
      if (!pricing) return out;
      if (pricing.tier1MinQty && pricing.tier1Discount != null) {
        out.push({
          minQty: Number(pricing.tier1MinQty),
          maxQty: pricing.tier2MinQty ? Number(pricing.tier2MinQty) - 1 : null,
          discountPct: Number(pricing.tier1Discount),
        });
      }
      if (pricing.tier2MinQty && pricing.tier2Discount != null) {
        out.push({
          minQty: Number(pricing.tier2MinQty),
          maxQty: pricing.tier3MinQty ? Number(pricing.tier3MinQty) - 1 : null,
          discountPct: Number(pricing.tier2Discount),
        });
      }
      if (pricing.tier3MinQty && pricing.tier3Discount != null) {
        out.push({
          minQty: Number(pricing.tier3MinQty),
          maxQty: null,
          discountPct: Number(pricing.tier3Discount),
        });
      }
      return out;
    }
    return raw.map(function (b) {
      return {
        minQty: Number(b.minQty),
        maxQty: b.maxQty == null || b.maxQty === '' ? null : Number(b.maxQty),
        discountPct: Number(b.discountPct || 0),
        price: b.price == null || b.price === '' ? null : Number(b.price),
      };
    });
  }
  function calcSide(pricing, qty, allowQtyOne) {
    if (!pricing) return { unitPrice: 0, discountPct: 0, lineTotal: 0, tierApplied: 0 };
    var base = Number(pricing.price) || 0;
    var bands = parseBands(pricing);
    var i;
    var discountPct = 0;
    var tierApplied = 0;
    var unit = base;
    // Retail mirrors live: volume tiers apply only when qty > 1. Wholesale applies at MOQ+.
    if (allowQtyOne || qty > 1) {
      for (i = bands.length - 1; i >= 0; i -= 1) {
        var b = bands[i];
        if (qty >= b.minQty && (b.maxQty == null || qty <= b.maxQty)) {
          tierApplied = i + 1;
          discountPct = Number(b.discountPct) || 0;
          unit = b.price != null && isFinite(Number(b.price)) ? Number(b.price) : base * (1 - discountPct / 100);
          break;
        }
      }
    }
    unit = round2(unit);
    return { unitPrice: unit, discountPct: discountPct, lineTotal: round2(unit * qty), tierApplied: tierApplied };
  }
  function calcPrice(cfg, qty) {
    var moq = Math.max(1, Number(cfg.moq) || 1);
    var wholesaleOn = cfg.wholesaleAvailable && cfg.wholesale && qty >= moq;
    if (wholesaleOn) return { mode: 'wholesale', result: calcSide(cfg.wholesale, qty, true), active: cfg.wholesale };
    return { mode: 'retail', result: calcSide(cfg.retail, qty, false), active: cfg.retail };
  }

  qsa('[data-pricing-root]').forEach(function (root) {
    var cfgEl = qs('#obPricingCfg', root) || qs('#obPricingCfg');
    if (!cfgEl) return;
    var cfg;
    try { cfg = JSON.parse(cfgEl.textContent || '{}'); } catch (e) { return; }
    if (!cfg.retail) return;
    var qtyInput = qs('[data-qty-input]', root) || qs('input[name="quantity"]', root);
    var priceEl = qs('[data-unit-price]', root);
    var compareEl = qs('[data-compare-price]', root);
    var saveEl = qs('[data-save-pct]', root);
    var totalEl = qs('[data-line-total]', root);
    var panel = qs('[data-pricing-panel]', root);
    var modePill = qs('[data-mode-pill]', root);
    var tierPill = qs('[data-tier-pill]', root);
    var moqMet = qs('[data-moq-met]', root);
    var tierBody = qs('[data-tier-body]', root);
    if (!qtyInput || !priceEl) return;

    function setHidden(el, hidden) {
      if (!el) return;
      if (hidden) {
        if (el.className.indexOf('is-hidden') === -1) el.className += ' is-hidden';
      } else {
        el.className = el.className.replace(/\bis-hidden\b/g, '').replace(/\s+/g, ' ').trim();
      }
    }

    function rebuildTierTable(mode, active, qty) {
      if (!tierBody || !active) return;
      var bands = parseBands(active);
      var base = Number(active.price) || 0;
      var html = '';
      var firstMin = bands.length ? bands[0].minQty : null;
      var activeIdx = 0;
      var i;
      for (i = bands.length - 1; i >= 0; i -= 1) {
        if (qty >= bands[i].minQty && (bands[i].maxQty == null || qty <= bands[i].maxQty)) {
          activeIdx = i + 1;
          break;
        }
      }
      html += '<tr data-tier-row="0" class="' + (activeIdx === 0 ? 'is-active' : '') + '"><td>1' +
        (firstMin && firstMin > 1 ? '–' + (firstMin - 1) : '+') +
        '</td><td>—</td><td>' + moneyBd(base) + '</td></tr>';
      for (i = 0; i < bands.length; i += 1) {
        var b = bands[i];
        var unit = b.price != null ? b.price : base * (1 - (Number(b.discountPct) || 0) / 100);
        html += '<tr data-tier-row="' + (i + 1) + '" class="' + (activeIdx === i + 1 ? 'is-active' : '') + '"><td>' +
          b.minQty + (b.maxQty != null ? '–' + b.maxQty : '+') +
          '</td><td class="tier-disc">-' + (Number(b.discountPct) || 0) + '%</td><td>' + moneyBd(unit) + '</td></tr>';
      }
      tierBody.innerHTML = html;
    }

    function recalc() {
      var qty = parseInt(qtyInput.value, 10) || 1;
      var max = parseInt(qtyInput.getAttribute('max'), 10) || cfg.maxQty || 25;
      if (qty > max) {
        qty = max;
        qtyInput.value = String(max);
      }
      var out = calcPrice(cfg, qty);
      var unit = out.result.unitPrice;
      var compareAt = out.active && out.active.compareAt != null ? Number(out.active.compareAt) : null;
      var base = out.active ? Number(out.active.price) || 0 : 0;
      var previous = compareAt && compareAt > unit ? compareAt : (out.result.discountPct > 0 && base > unit ? base : null);
      var savePct = previous && previous > unit ? Math.round((1 - unit / previous) * 100) : 0;

      priceEl.textContent = moneyBd(unit);
      if (totalEl) totalEl.textContent = moneyBd(out.result.lineTotal);
      if (compareEl) {
        if (previous) {
          compareEl.textContent = moneyBd(previous);
          setHidden(compareEl, false);
        } else {
          setHidden(compareEl, true);
        }
      }
      if (saveEl) {
        if (savePct >= 5) {
          var saveLabel = saveEl.getAttribute('data-label') || 'Save';
          saveEl.textContent = saveLabel + ' ' + savePct + '%';
          setHidden(saveEl, false);
        } else {
          setHidden(saveEl, true);
        }
      }
      if (panel) {
        panel.className = 'pricing-panel ' + (out.mode === 'wholesale' ? 'is-wholesale' : 'is-retail');
      }
      if (modePill) {
        modePill.textContent = out.mode === 'wholesale'
          ? (modePill.getAttribute('data-label-wholesale') || 'Wholesale')
          : (modePill.getAttribute('data-label-retail') || 'Retail');
      }
      if (tierPill) {
        if (out.result.discountPct > 0) {
          tierPill.textContent = '-' + out.result.discountPct + '%';
          setHidden(tierPill, false);
        } else {
          setHidden(tierPill, true);
        }
      }
      if (moqMet) setHidden(moqMet, !(out.mode === 'wholesale'));
      rebuildTierTable(out.mode, out.active, qty);

    }

    qtyInput.addEventListener('change', recalc);
    qtyInput.addEventListener('input', recalc);
    recalc();
  });

  // ── App download top banner + multi-popup engine ──
  function readJsonScript(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent || 'null'); } catch (e) { return null; }
  }
  function detectPlatform() {
    var ua = (navigator.userAgent || '').toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/android/.test(ua)) return 'android';
    if (/windows/.test(ua)) return 'windows';
    if (/macintosh|mac os x/.test(ua)) return 'mac';
    return 'other';
  }
  function showEl(el) {
    if (!el) return;
    el.hidden = false;
    el.className = String(el.className || '').replace(/\bis-hidden\b/g, '').replace(/\s+/g, ' ').trim();
  }
  function hideEl(el) {
    if (!el) return;
    el.hidden = true;
    if (String(el.className || '').indexOf('is-hidden') === -1) el.className = (el.className || '') + ' is-hidden';
  }

  (function initAppDownloadBanner() {
    var cfg = readJsonScript('obAppDownloadCfg') || {};
    if (cfg.enabled === false) return;
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return;
    var dismissed = localStorage.getItem('ob_app_download_dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 7 * 86400000) return;

    var platform = detectPlatform();
    var href = '';
    var pwa = false;
    var label = 'Install';
    if (platform === 'android') { href = cfg.androidUrl || ''; pwa = !href; label = href ? 'Download' : 'Install'; }
    else if (platform === 'ios') { href = cfg.iosUrl || ''; pwa = !href; label = href ? 'Download' : 'Install'; }
    else if (platform === 'windows') { href = cfg.windowsUrl || ''; pwa = !href; label = href ? 'Download' : 'Install'; }
    else if (platform === 'mac') { href = cfg.macUrl || ''; pwa = !href; label = href ? 'Download' : 'Install'; }
    else { href = cfg.androidUrl || cfg.iosUrl || ''; pwa = !href; }

    var banner = document.getElementById('obAppDownloadBanner');
    var slot = document.getElementById('obAppDownloadSlot');
    if (!banner) return;
    if (slot) slot.appendChild(banner);
    banner.innerHTML =
      '<div class="app-dl-inner">' +
      '<span class="app-dl-icon" data-platform="' + platform + '" aria-hidden="true"></span>' +
      '<div class="app-dl-copy"><strong>' + (cfg.bannerText || 'Get the OceanBazar app') + '</strong>' +
      '<span>' + platform + (pwa ? ' · Web app' : ' · Store') + '</span></div>' +
      '<button type="button" class="app-dl-cta" data-app-dl-cta>' + label + '</button>' +
      '<button type="button" class="app-dl-x" data-app-dl-close aria-label="Close">×</button>' +
      '</div>';
    banner.className = 'app-dl-banner app-anim-' + String(cfg.animation || 'slide-down').replace(/[^a-z0-9-]/gi, '');
    showEl(banner);

    var cta = qs('[data-app-dl-cta]', banner);
    var closeBtn = qs('[data-app-dl-close]', banner);
    if (cta) {
      cta.addEventListener('click', function () {
        if (href) window.open(href, '_blank');
        else alert(platform === 'ios'
          ? 'Tap Share, then Add to Home Screen to install OceanBazar.'
          : 'Use your browser Install / Add to Home Screen for the OceanBazar web app.');
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        hideEl(banner);
        localStorage.setItem('ob_app_download_dismissed', String(Date.now()));
      });
    }
  })();

  (function initStorefrontPopups() {
    var cfg = readJsonScript('obStorefrontPopupsCfg');
    if (!cfg || !Array.isArray(cfg.popups) || !cfg.popups.length) {
      return;
    }
    if (localStorage.getItem('ob_e2e_disable_popups') === '1') {
      return;
    }

    var root = qs('[data-popup-root]');
    if (!root) {
      return;
    }
    var dialog = qs('[data-popup-dialog]', root);
    var titleEl = qs('[data-popup-title]', root);
    var textEl = qs('[data-popup-text]', root);
    var imgEl = qs('[data-popup-image]', root);
    var linkBtn = qs('[data-popup-link]', root);
    var closeBtn = qs('[data-popup-close-btn]', root);
    var xBtn = qs('[data-popup-close]', root);
    var backdrop = qs('[data-popup-backdrop]', root);

    function dismissed(p) {
      var raw = localStorage.getItem('ob_popup_dismissed_' + p.id);
      if (!raw) return false;
      var hours = Number(p.dismissHours != null ? p.dismissHours : 24);
      if (!isFinite(hours) || hours <= 0) return true;
      return Date.now() - Number(raw) < hours * 3600000;
    }

    var queue = cfg.popups.filter(function (p) {
      if (!p || p.enabled === false) return false;
      if (dismissed(p)) return false;
      if (cfg.loggedIn) {
        if (p.type === 'welcome') return false;
        if (p.showToLoggedIn === false) return false;
      }
      return true;
    }).sort(function (a, b) { return (a.sortOrder || 0) - (b.sortOrder || 0); });


    var active = null;

    function dismiss() {
      if (!active) return;
      localStorage.setItem('ob_popup_dismissed_' + active.id, String(Date.now()));
      queue = queue.filter(function (p) { return p.id !== active.id; });
      active = null;
      hideEl(root);
      if (queue.length) setTimeout(showNext, Math.max(200, Number(queue[0].delayMs) || 600));
    }

    function showNext() {
      if (!queue.length) return;
      active = queue[0];
      var anim = String(active.animation || 'zoom-in').replace(/[^a-z0-9-]/gi, '');
      if (dialog) dialog.className = 'ob-popup-dialog popup-anim-' + anim;
      if (titleEl) titleEl.textContent = active.title || '';
      if (textEl) textEl.textContent = active.body || '';
      if (imgEl) {
        if (active.imageUrl) {
          imgEl.src = active.imageUrl;
          showEl(imgEl);
        } else {
          hideEl(imgEl);
        }
      }
      var isLink = active.buttonAction === 'link';
      var label = isLink
        ? (active.buttonLabel || 'Continue')
        : (active.buttonCloseMessage || active.buttonLabel || 'Close');
      if (linkBtn && closeBtn) {
        if (isLink) {
          var url = active.buttonUrl || (cfg.basePath + '/' + cfg.locale + '/products');
          linkBtn.href = url;
          linkBtn.textContent = label;
          showEl(linkBtn);
          hideEl(closeBtn);
        } else {
          closeBtn.textContent = label;
          showEl(closeBtn);
          hideEl(linkBtn);
        }
      }
      showEl(root);
    }

    if (xBtn) xBtn.addEventListener('click', dismiss);
    if (closeBtn) closeBtn.addEventListener('click', dismiss);
    if (backdrop) backdrop.addEventListener('click', dismiss);
    if (linkBtn) linkBtn.addEventListener('click', function () { dismiss(); });

    if (queue.length) {
      var delay = Math.max(0, Number(queue[0].delayMs) || 1200);
      setTimeout(showNext, delay);
    }
  })();

  // Lite chat: AJAX poll + rich message render (no sockets; ES5-friendly)
  (function initChatPoll() {
    var root = qs('[data-chat-poll]');
    if (!root) return;
    var sec = parseInt(root.getAttribute('data-chat-poll'), 10) || 10;
    if (sec < 5) sec = 5;
    var pollUrl = root.getAttribute('data-chat-poll-url') || '';
    var actionUrl = root.getAttribute('data-chat-action-url') || '';
    var basePath = root.getAttribute('data-chat-base') || '';
    var locale = root.getAttribute('data-chat-locale') || 'en';
    var sessionId = root.getAttribute('data-chat-session') || '';
    var thread = qs('#chatThread');
    var statusPill = qs('#chatStatusPill');
    if (thread) {
      try { thread.scrollTop = thread.scrollHeight; } catch (e2) {}
    }

    function escapeHtml(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function money(n) {
      var v = Number(n || 0);
      return '৳' + (isFinite(v) ? v.toLocaleString() : '0');
    }

    function withBase(u) {
      var url = String(u || '');
      if (!url) return '';
      if (url.indexOf('http') === 0) return url;
      if (basePath && url.indexOf(basePath) === 0) return url;
      return basePath + (url.charAt(0) === '/' ? url : '/' + url);
    }

    function productHref(p) {
      return withBase(p.url || ('/' + locale + '/product/' + p.id));
    }

    function actionForm(action, label, extraHidden) {
      var html = '<form method="post" action="' + escapeHtml(actionUrl) + '" class="inline-form">';
      html += '<input type="hidden" name="sessionId" value="' + escapeHtml(sessionId) + '" />';
      html += '<input type="hidden" name="action" value="' + escapeHtml(action) + '" />';
      if (extraHidden) html += extraHidden;
      html += '<button type="submit" class="chip-btn">' + escapeHtml(label) + '</button></form>';
      return html;
    }

    function renderMessage(m) {
      var sender = m.sender || 'bot';
      var raw = m.content;
      var isArr = Object.prototype.toString.call(raw) === '[object Array]';
      var content = (!isArr && raw && typeof raw === 'object') ? raw : {};
      var text = m.message || content.text || content.title || '';
      var mtype = m.message_type || m.type || content.type || 'text';
      var products = (mtype === 'product_card' && isArr) ? raw : [];
      var order = (mtype === 'order_card' && content.orderNumber) ? content : null;
      var systemAction = (mtype === 'system_action' && content.action) ? content : null;
      var quickReplies = Object.prototype.toString.call(m.quickReplies) === '[object Array]'
        ? m.quickReplies
        : (Object.prototype.toString.call(content.quickReplies) === '[object Array]' ? content.quickReplies : []);
      var links = [];
      if (content.url || content.href) {
        links.push({ href: content.url || content.href, label: content.linkLabel || content.title || content.label || 'Open' });
      }
      if (!text && !products.length && !order && !systemAction && !links.length && !quickReplies.length) return '';

      // #region agent log
      if (mtype === 'product_card') {
        try {
          fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1eb282'},body:JSON.stringify({sessionId:'1eb282',runId:'pre-fix',hypothesisId:'H7',location:'app.js:renderMessage',message:'lite render product_card',data:{count:products.length,hasText:!!text},timestamp:Date.now()})}).catch(function(){});
        } catch (eLog) {}
      }
      // #endregion

      var html = '<div class="chat-bubble chat-' + escapeHtml(sender) + '" data-mid="' + escapeHtml(m.id || '') + '" data-mtype="' + escapeHtml(mtype) + '">';
      html += '<span class="chat-who">' + escapeHtml(sender === 'user' ? 'You' : (m.senderName || (sender === 'bot' ? 'OceanBazar' : sender))) + '</span>';
      if (text) html += '<p>' + escapeHtml(text) + '</p>';

      if (products.length) {
        html += '<ul class="chat-products">';
        for (var i = 0; i < products.length; i++) {
          var p = products[i] || {};
          html += '<li class="chat-product">';
          if (p.image) html += '<img class="chat-product-img" src="' + escapeHtml(p.image) + '" alt="" width="48" height="48" loading="lazy" />';
          html += '<div class="chat-product-body">';
          html += '<a class="chat-product-name" href="' + escapeHtml(productHref(p)) + '">' + escapeHtml(p.name || p.title || 'Product') + '</a>';
          html += '<span class="chat-product-price">' + escapeHtml(money(p.price)) + '</span>';
          html += '<div class="chat-product-actions">';
          html += '<a class="chip-btn" href="' + escapeHtml(productHref(p)) + '">View</a>';
          html += actionForm('add_to_cart', 'Add to cart', '<input type="hidden" name="productId" value="' + escapeHtml(p.id || '') + '" />');
          html += '</div></div></li>';
        }
        html += '</ul>';
      }

      if (order) {
        html += '<div class="chat-order"><p><strong>#' + escapeHtml(order.orderNumber) + '</strong> · ' + escapeHtml(order.status || '') + '</p>';
        if (order.total != null) html += '<p>' + escapeHtml(money(order.total)) + '</p>';
        if (order.trackingNumber) html += '<p class="muted">Tracking: <code>' + escapeHtml(order.trackingNumber) + '</code></p>';
        if (Object.prototype.toString.call(order.timeline) === '[object Array]') {
          html += '<ol class="chat-order-timeline">';
          for (var t = 0; t < order.timeline.length; t++) {
            var step = order.timeline[t] || {};
            html += '<li class="' + (step.done ? 'is-done' : '') + '">' + escapeHtml(step.label || '') + '</li>';
          }
          html += '</ol>';
        }
        html += '</div>';
      }

      if (systemAction) {
        var saUrl = systemAction.url ? withBase(systemAction.url) : '';
        html += '<div class="chat-system-action">';
        if (saUrl) {
          html += '<a class="btn btn-primary btn-sm" href="' + escapeHtml(saUrl) + '">' + escapeHtml(systemAction.label || systemAction.action) + '</a>';
        } else {
          html += actionForm(systemAction.action, systemAction.label || systemAction.action, '');
        }
        html += '</div>';
      }

      for (var j = 0; j < links.length; j++) {
        html += '<p><a href="' + escapeHtml(withBase(links[j].href)) + '" target="_blank" rel="noopener">' + escapeHtml(links[j].label) + '</a></p>';
      }

      if (quickReplies.length && sender !== 'user') {
        html += '<div class="chat-inline-replies">';
        for (var q = 0; q < quickReplies.length; q++) {
          var qr = quickReplies[q];
          var qLabel = typeof qr === 'string' ? qr : ((qr && (qr.label || qr.text || qr.action)) || '');
          var qAction = typeof qr === 'string' ? qr : ((qr && (qr.action || qr.label || qr.text)) || '');
          if (!qLabel) continue;
          html += actionForm(qAction, qLabel, '');
        }
        html += '</div>';
      }

      html += '</div>';
      return html;
    }

    function applyPoll(data) {
      if (!data || !data.ok || !thread) return;
      var msgs = data.messages || [];
      var html = '';
      var productCards = 0;
      for (var i = 0; i < msgs.length; i++) {
        if (msgs[i] && msgs[i].message_type === 'product_card') productCards += 1;
        html += renderMessage(msgs[i]);
      }
      // #region agent log
      try {
        fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1eb282'},body:JSON.stringify({sessionId:'1eb282',runId:'pre-fix',hypothesisId:'H7',location:'app.js:applyPoll',message:'lite chat poll applied',data:{msgCount:msgs.length,productCards:productCards,htmlLen:html.length},timestamp:Date.now()})}).catch(function(){});
      } catch (eP) {}
      // #endregion
      if (html && thread.innerHTML !== html) {
        var nearBottom = (thread.scrollHeight - thread.scrollTop - thread.clientHeight) < 80;
        thread.innerHTML = html;
        thread.setAttribute('data-msg-count', String(msgs.length));
        if (nearBottom) {
          try { thread.scrollTop = thread.scrollHeight; } catch (e3) {}
        }
      }
      if (statusPill && data.session && data.session.status) {
        statusPill.textContent = data.session.status;
      }
    }

    function tick() {
      if (!pollUrl || typeof fetch !== 'function') {
        try { window.location.reload(); } catch (e) {}
        return;
      }
      fetch(pollUrl, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-Requested-With': 'oceanbazar-lite-ajax' },
      })
        .then(function (r) { return r.json(); })
        .then(applyPoll)
        .catch(function () { /* keep polling */ })
        .then(function () { setTimeout(tick, sec * 1000); });
    }

    setTimeout(tick, sec * 1000);
  })();

  // OTP verify: prevent double-submit (second click invalidates a just-used code)
  (function initOtpGuard() {
    var form = qs('#otpVerifyForm');
    if (!form) return;
    var submitting = false;
    form.addEventListener('submit', function (ev) {
      if (submitting) {
        if (ev && ev.preventDefault) ev.preventDefault();
        return false;
      }
      submitting = true;
      var btn = qs('button[type="submit"]', form);
      if (btn) {
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
      }
      return true;
    });
  })();

  // Lite search: recent + trending + lightweight suggest (ES5, no frameworks)
  (function initLiteSearch() {
    var RECENT_KEY = 'ob_recent_searches';
    var MAX_RECENT = 6;
    var form = qs('#liteSearchForm');
    var input = qs('#liteSearchInput');
    var panel = qs('#liteSearchPanel');
    var clearBtn = qs('#liteSearchClear');
    if (!form || !input || !panel) return;

    var suggestUrl = form.getAttribute('data-suggest-url') || '';
    var trendingUrl = form.getAttribute('data-trending-url') || '';
    var searchUrl = form.getAttribute('data-search-url') || '';
    var productUrl = form.getAttribute('data-product-url') || '';
    var timer = null;
    var activeIdx = -1;
    var items = [];
    var trendingCache = null;
    var trendingFetched = false;

    function getRecent() {
      try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { return []; }
    }
    function saveRecent(term) {
      if (!term || term.length < 2) return;
      try {
        var arr = getRecent().filter(function (s) { return s !== term; });
        arr.unshift(term);
        localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, MAX_RECENT)));
      } catch (e) {}
    }
    function clearRecent() {
      try { localStorage.removeItem(RECENT_KEY); } catch (e) {}
    }
    function esc(s) {
      return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
    function money(n) {
      if (n == null || n === '' || isNaN(Number(n))) return '';
      try { return '৳' + Number(n).toLocaleString(); } catch (e) { return '৳' + String(n); }
    }
    function syncClear() {
      if (!clearBtn) return;
      if (String(input.value || '').trim()) clearBtn.removeAttribute('hidden');
      else clearBtn.setAttribute('hidden', 'hidden');
    }
    function closePanel() {
      panel.setAttribute('hidden', 'hidden');
      panel.innerHTML = '';
      activeIdx = -1;
      items = [];
    }
    function openPanel() {
      panel.removeAttribute('hidden');
    }
    function setActive(idx) {
      activeIdx = idx;
      qsa('[data-search-item]', panel).forEach(function (el, i) {
        if (i === idx) el.className = String(el.className || '').replace(/\bis-active\b/g, '').trim() + ' is-active';
        else el.className = String(el.className || '').replace(/\bis-active\b/g, '').trim();
      });
    }
    function chipHtml(terms, kind) {
      if (!terms || !terms.length) return '';
      return terms.map(function (term, i) {
        var href = searchUrl + '?q=' + encodeURIComponent(term);
        return '<a class="chip-text" href="' + esc(href) + '" data-search-item data-kind="' + kind + '" data-term="' + esc(term) + '" data-idx="' + i + '">' + esc(term) + '</a>';
      }).join('');
    }
    function renderIdle() {
      var recent = getRecent();
      var html = '';
      if (recent.length) {
        html += '<div class="search-panel-section"><div class="search-panel-label"><span>' + esc(form.getAttribute('data-i18n-recent')) + '</span>' +
          '<button type="button" class="link-muted" data-clear-recent-panel>' + esc(form.getAttribute('data-i18n-clear')) + '</button></div>' +
          '<div class="chip-row">' + chipHtml(recent, 'recent') + '</div></div>';
      }
      if (trendingCache && trendingCache.length) {
        html += '<div class="search-panel-section"><div class="search-panel-label"><span>' + esc(form.getAttribute('data-i18n-trending')) + '</span></div>' +
          '<div class="chip-row">' + chipHtml(trendingCache, 'trend') + '</div></div>';
      }
      if (!html) {
        closePanel();
        return;
      }
      panel.innerHTML = html;
      items = qsa('[data-search-item]', panel);
      openPanel();
    }
    function renderSuggest(list, q) {
      if (!list.length) {
        panel.innerHTML = '<div class="search-panel-section"><p class="search-suggest-sub">' + esc(form.getAttribute('data-i18n-no-match')) + '</p></div>' +
          '<a class="search-panel-footer" href="' + esc(searchUrl + '?q=' + encodeURIComponent(q)) + '">' + esc(form.getAttribute('data-i18n-see-all')) + '</a>';
        items = [];
        openPanel();
        return;
      }
      var rows = list.slice(0, 6).map(function (s, i) {
        var href = productUrl + encodeURIComponent(s.id);
        var thumb = s.image
          ? '<img class="search-suggest-thumb" src="' + esc(s.image) + '" alt="" width="36" height="36" loading="lazy" decoding="async" />'
          : '<span class="search-suggest-thumb" aria-hidden="true"></span>';
        var sub = [s.category, money(s.price)].filter(Boolean).join(' · ');
        return '<a class="search-suggest" href="' + esc(href) + '" data-search-item data-kind="product" data-term="' + esc(q) + '" data-idx="' + i + '">' +
          thumb + '<span class="search-suggest-meta"><span class="search-suggest-title">' + esc(s.title || '') + '</span>' +
          (sub ? '<span class="search-suggest-sub">' + esc(sub) + '</span>' : '') + '</span></a>';
      }).join('');
      panel.innerHTML = '<div class="search-panel-section">' + rows + '</div>' +
        '<a class="search-panel-footer" href="' + esc(searchUrl + '?q=' + encodeURIComponent(q)) + '" data-search-item data-kind="seeall" data-term="' + esc(q) + '">' +
        esc(form.getAttribute('data-i18n-see-all')) + '</a>';
      items = qsa('[data-search-item]', panel);
      openPanel();
    }
    function fetchTrending() {
      if (trendingFetched || !trendingUrl) return;
      trendingFetched = true;
      fetch(trendingUrl + '?limit=8', { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          trendingCache = Array.isArray(data && data.trending) ? data.trending : [];
          if (document.activeElement === input && String(input.value || '').trim().length < 2) renderIdle();
        })
        .catch(function () { trendingCache = []; });
    }
    function fetchSuggest(q) {
      if (!suggestUrl || q.length < 2) {
        renderIdle();
        return;
      }
      fetch(suggestUrl + '?q=' + encodeURIComponent(q) + '&limit=6', { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (String(input.value || '').trim() !== q) return;
          renderSuggest(Array.isArray(data && data.suggestions) ? data.suggestions : [], q);
          // #region agent log
          fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1eb282'},body:JSON.stringify({sessionId:'1eb282',runId:'pre-fix',hypothesisId:'H7',location:'app.js:liteSearch',message:'lite suggest response',data:{qLen:q.length,count:(data&&data.suggestions&&data.suggestions.length)||0},timestamp:Date.now()})}).catch(function(){});
          // #endregion
        })
        .catch(function () { renderSuggest([], q); });
    }

    input.addEventListener('focus', function () {
      syncClear();
      fetchTrending();
      if (String(input.value || '').trim().length >= 2) fetchSuggest(String(input.value || '').trim());
      else renderIdle();
    });
    input.addEventListener('input', function () {
      syncClear();
      var q = String(input.value || '').trim();
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        if (q.length >= 2) fetchSuggest(q);
        else renderIdle();
      }, 280);
    });
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        input.value = '';
        syncClear();
        input.focus();
        renderIdle();
      });
    }
    form.addEventListener('submit', function () {
      saveRecent(String(input.value || '').trim());
    });
    panel.addEventListener('click', function (ev) {
      var t = ev.target;
      while (t && t !== panel && !(t.getAttribute && t.getAttribute('data-clear-recent-panel') != null)) t = t.parentNode;
      if (t && t.getAttribute && t.getAttribute('data-clear-recent-panel') != null) {
        if (ev.preventDefault) ev.preventDefault();
        clearRecent();
        renderIdle();
        return;
      }
      var item = ev.target;
      while (item && item !== panel && !(item.getAttribute && item.getAttribute('data-term'))) item = item.parentNode;
      if (item && item.getAttribute) {
        var term = item.getAttribute('data-term');
        if (term) saveRecent(term);
      }
    });
    document.addEventListener('click', function (ev) {
      if (!form.contains(ev.target)) closePanel();
    });
    input.addEventListener('keydown', function (ev) {
      var key = ev.keyCode || ev.which;
      if (key === 27) { closePanel(); return; }
      if (!items.length || panel.hasAttribute('hidden')) return;
      if (key === 40) {
        if (ev.preventDefault) ev.preventDefault();
        setActive(activeIdx < items.length - 1 ? activeIdx + 1 : 0);
      } else if (key === 38) {
        if (ev.preventDefault) ev.preventDefault();
        setActive(activeIdx > 0 ? activeIdx - 1 : items.length - 1);
      } else if (key === 13 && activeIdx >= 0 && items[activeIdx]) {
        if (ev.preventDefault) ev.preventDefault();
        var term = items[activeIdx].getAttribute('data-term');
        if (term) saveRecent(term);
        window.location.href = items[activeIdx].href;
      }
    });
    syncClear();

    // Search page recent chips (SSR page progressive enhance)
    var recentBox = qs('[data-recent-searches]');
    var recentList = qs('[data-recent-list]');
    var clearPageRecent = qs('[data-clear-recent]');
    if (recentBox && recentList) {
      var recent = getRecent();
      if (recent.length) {
        recentList.innerHTML = recent.map(function (term) {
          return '<a class="chip-text" href="' + esc(searchUrl + '?q=' + encodeURIComponent(term)) + '">' + esc(term) + '</a>';
        }).join('');
        recentBox.removeAttribute('hidden');
      }
      if (clearPageRecent) {
        clearPageRecent.addEventListener('click', function () {
          clearRecent();
          recentBox.setAttribute('hidden', 'hidden');
          recentList.innerHTML = '';
        });
      }
    }
  })();
})();
