const express = require('express');
const { bffGet, bffSend, BffError } = require('../bffClient');
const { unwrapList, paginationMeta, pickName } = require('../helpers');
const { authedFetch } = require('../session');
const { bp, BASE_PATH } = require('../config');

const STATIC_TRENDING = {
  en: ['iPhone', 'Samsung Galaxy', 'Laptop', 'Headphones', 'Smart Watch', 'Camera', 'Perfume', 'Sneakers'],
  bn: ['আইফোন', 'স্যামসাং', 'ল্যাপটপ', 'হেডফোন', 'স্মার্ট ওয়াচ', 'ক্যামেরা', 'পারফিউম', 'স্নিকার্স'],
};

async function fetchTrendingTerms(locale, limit = 8) {
  try {
    const data = await bffGet('/api/search/trending', { lang: locale, limit });
    const list = Array.isArray(data?.trending) ? data.trending.filter(Boolean) : [];
    if (list.length) return list.slice(0, limit);
  } catch { /* fall through */ }
  return (STATIC_TRENDING[locale] || STATIC_TRENDING.en).slice(0, limit);
}

function mountCatalog(router) {
  router.get('/:locale', async (req, res) => {
    const locale = req.locale;
    const collections = [
      { key: 'featured', titleKey: 'featured', collection: 'featured' },
      { key: 'latest', titleKey: 'latest', collection: 'latest' },
      { key: 'best-deals', titleKey: 'bestDeals', collection: 'best-deals' },
      { key: 'top-trending', titleKey: 'topTrending', collection: 'top-trending' },
    ];

    const [categories, trustBadgesPayload, ...lists] = await Promise.all([
      bffGet('/api/categories').catch(() => ({ categories: [] })),
      bffGet('/api/trust-badges').catch(() => ({ badges: [] })),
      ...collections.map((c) =>
        bffGet('/api/products', { lang: locale, collection: c.collection, limit: 10, page: 1 }).catch(
          () => ({ products: [] }),
        ),
      ),
    ]);

    const sections = collections.map((c, i) => ({
      ...c,
      products: unwrapList(lists[i], ['products', 'items', 'data']),
    }));

    const cats = unwrapList(categories, ['categories', 'data']);
    const trustBadges = Array.isArray(trustBadgesPayload?.badges)
      ? trustBadgesPayload.badges.filter((b) => Number(b.productCount) > 0)
      : [];
    const heroSlides = Array.isArray(res.locals.settings?.heroSlides)
      ? res.locals.settings.heroSlides.slice(0, 8)
      : Array.isArray(res.locals.settings?.banners)
        ? res.locals.settings.banners.slice(0, 8)
        : [];

    const s = res.locals.settings || {};
    // #region agent log
    fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'078c95'},body:JSON.stringify({sessionId:'078c95',runId:'trust-badges',hypothesisId:'T1',location:'catalog.js:home',message:'lite home trust badges',data:{logoCms:!!(s.logoLightUrl||s.logoDarkUrl),productTrustCount:trustBadges.length,testimonialCount:Array.isArray(s.testimonials)?s.testimonials.length:0,bannerMs:s.defaultBannerRotationMs||null,testimonialMs:s.testimonialCarouselMs||null},timestamp:Date.now()})}).catch(function(){});
    // #endregion

    res.render('home', {
      title: res.locals.t('home'),
      sections,
      categories: cats.slice(0, 12),
      heroSlides,
      trustBadges,
    });
  });

  router.get('/:locale/products', async (req, res) => {
    await renderProductList(req, res, {});
  });

  router.get('/:locale/products/:collection', async (req, res) => {
    await renderProductList(req, res, { collection: req.params.collection });
  });

  router.get('/:locale/category/:id', async (req, res) => {
    await renderProductList(req, res, { category: req.params.id });
  });

  /** JSON proxies for lite header autocomplete (same-origin, no browser→API CORS). */
  router.get('/:locale/search/suggest', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const locale = req.locale;
    if (q.length < 2) return res.json({ suggestions: [] });
    try {
      const data = await bffGet('/api/search/suggest', {
        q,
        lang: locale,
        limit: Math.min(8, Number(req.query.limit) || 6),
      });
      res.json({ suggestions: Array.isArray(data?.suggestions) ? data.suggestions : [] });
    } catch {
      res.json({ suggestions: [] });
    }
  });

  router.get('/:locale/search/trending', async (req, res) => {
    const terms = await fetchTrendingTerms(req.locale, Math.min(12, Number(req.query.limit) || 8));
    res.json({ trending: terms });
  });

  router.get('/:locale/search', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const locale = req.locale;
    if (q.length >= 2) {
      bffSend('POST', '/api/search/log', { query: q }).catch(() => {});
    }
    const trending = await fetchTrendingTerms(locale, 8);
    // #region agent log
    fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1eb282'},body:JSON.stringify({sessionId:'1eb282',runId:'pre-fix',hypothesisId:'H7',location:'catalog.js:search',message:'lite search page render',data:{qLen:q.length,hasCategory:Boolean(req.query.category),sort:String(req.query.sort||'newest'),trendingCount:trending.length,locale},timestamp:Date.now()})}).catch(function(){});
    // #endregion

    // Empty query: discovery UI only (no full catalog dump).
    if (!q) {
      let categories = [];
      try {
        categories = unwrapList(await bffGet('/api/categories'), ['categories', 'data']);
      } catch {
        categories = [];
      }
      return res.render('search', {
        title: res.locals.t('search'),
        products: [],
        pagination: { page: 1, pages: 1, total: 0, limit: 24 },
        categories,
        sort: String(req.query.sort || 'newest'),
        filters: {},
        searchQuery: '',
        collection: '',
        categoryId: '',
        trending,
      });
    }

    await renderProductList(req, res, { search: q }, {
      view: 'search',
      title: q || res.locals.t('search'),
      searchQuery: q,
      trending,
    });
  });

  router.get('/:locale/flash-deals', async (req, res) => {
    const locale = req.locale;
    let page = null;
    try {
      page = await bffGet('/api/flash-sales/page', {
        lang: locale,
        sale: req.query.sale || undefined,
      });
    } catch {
      page = null;
    }
    // /api/flash-sales/page returns { mode, campaigns:[{sale, products}], upcoming }.
    // Older shapes exposed products/sale at the top level — support both.
    const campaigns = Array.isArray(page?.campaigns) ? page.campaigns : [];
    let products = unwrapList(page?.products || page, ['products', 'items', 'data']);
    let sale = page?.sale || page?.activeSale || null;
    if ((!products || !products.length) && campaigns.length) {
      products = campaigns.reduce(
        (acc, c) => acc.concat(Array.isArray(c.products) ? c.products : []),
        [],
      );
      sale = campaigns[0] && campaigns[0].sale ? campaigns[0].sale : sale;
    }
    res.render('flash-deals', {
      title: res.locals.t('flashDeals'),
      page,
      products,
      sale,
    });
  });

  router.get('/:locale/product/:id', async (req, res) => {
    const locale = req.locale;
    const id = req.params.id;
    let product;
    try {
      product = await bffGet(`/api/products/${encodeURIComponent(id)}`, { lang: locale });
      if (product?.product) product = product.product;
    } catch (err) {
      if (err instanceof BffError && err.status === 404) {
        return res.status(404).render('error', {
          title: '404',
          message: res.locals.t('noProducts'),
        });
      }
      return res.status(502).render('error', {
        title: 'Error',
        message: res.locals.t('errorGeneric'),
      });
    }

    let reviews = [];
    let myReview = null;
    let reviewMeta = { averageRating: 0, totalReviews: 0 };
    let ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    try {
      const { accessToken, refreshToken } = require('../session').readTokens(req);
      let rev;
      if (accessToken || refreshToken) {
        const { data } = await authedFetch(req, res, `/api/reviews/product/${encodeURIComponent(id)}`, {
          query: { page: 1, sort: 'newest' },
        });
        rev = data;
      } else {
        rev = await bffGet(`/api/reviews/product/${encodeURIComponent(id)}`, {
          page: 1,
          sort: 'newest',
        });
      }
      reviews = unwrapList(rev, ['reviews', 'items', 'data']).slice(0, 20);
      myReview = rev?.myReview || null;
      ratingDistribution = rev?.ratingDistribution || ratingDistribution;
      const avg =
        rev?.averageRating ??
        rev?.ratingAvg ??
        rev?.meta?.averageRating ??
        product.ratingAvg ??
        0;
      const total =
        rev?.totalReviews ??
        rev?.total ??
        rev?.pagination?.total ??
        product.reviewCount ??
        reviews.length;
      reviewMeta = {
        averageRating: Number(avg) || 0,
        totalReviews: Number(total) || 0,
      };
    } catch {
      reviews = [];
      reviewMeta = {
        averageRating: Number(product.ratingAvg) || 0,
        totalReviews: Number(product.reviewCount) || 0,
      };
    }

    let qaItems = [];
    try {
      const { accessToken, refreshToken } = require('../session').readTokens(req);
      let qa;
      if (accessToken || refreshToken) {
        const { data } = await authedFetch(req, res, `/api/qa/${encodeURIComponent(id)}`);
        qa = data;
      } else {
        qa = await bffGet(`/api/qa/${encodeURIComponent(id)}`);
      }
      qaItems = unwrapList(qa, ['qa', 'items', 'data']).slice(0, 20);
    } catch {
      qaItems = [];
    }

    const variants = Array.isArray(product.variants) ? product.variants : [];
    const { optimizeImageUrl } = require('../helpers');
    const images = [];
    const rawImgs = product.images || product.media || [];
    for (const img of rawImgs) {
      const raw = typeof img === 'string' ? img : img?.url || img?.src || '';
      if (raw) images.push(optimizeImageUrl(raw, { width: 900, crop: 'limit' }));
    }
    if (!images.length && product.imageUrl) {
      images.push(optimizeImageUrl(product.imageUrl, { width: 900, crop: 'limit' }));
    }

    const flash = String(req.query.flash || '');
    const formError = String(req.query.error || '');
    const formNotice = String(req.query.notice || '');

    // #region agent log
    try {
      const fs = require('fs');
      const path = require('path');
      fs.appendFileSync(
        path.resolve(__dirname, '../../debug-1eb282.log'),
        `${JSON.stringify({
          sessionId: '1eb282',
          runId: 'lite-parity',
          hypothesisId: 'H-LITE-PDP',
          location: 'catalog.js:product/:id',
          message: 'lite PDP engagement loaded',
          data: {
            productId: String(id).slice(0, 12),
            reviews: reviews.length,
            qa: qaItems.length,
            avg: reviewMeta.averageRating,
            total: reviewMeta.totalReviews,
          },
          timestamp: Date.now(),
        })}\n`,
      );
    } catch { /* ignore */ }
    // #endregion

    res.render('product', {
      title: pickName(product, locale),
      product,
      variants,
      images,
      reviews,
      myReview,
      reviewMeta,
      ratingDistribution,
      qaItems,
      flash,
      formError,
      formNotice,
      query: req.query || {},
    });
  });

  router.post('/:locale/upload/image', async (req, res) => {
    const { proxyUpload } = require('../uploadProxy');
    try {
      const data = await proxyUpload(req, res, '/api/upload/image');
      const url = data?.secureUrl || data?.url || data?.secure_url;
      return res.json({ ok: true, url, ...data });
    } catch (err) {
      return res.status(err.status || 500).json({ ok: false, error: err.message || 'Upload failed' });
    }
  });

  // Soft poll for reviews/Q&A counts (tiny JSON; no full page remount)
  router.get('/:locale/product/:id/engagement.json', async (req, res) => {
    const id = req.params.id;
    let reviewCount = 0;
    let averageRating = 0;
    let qaCount = 0;
    try {
      const rev = await bffGet(`/api/reviews/product/${encodeURIComponent(id)}`, {
        page: 1,
        sort: 'newest',
      });
      const list = unwrapList(rev, ['reviews', 'items', 'data']);
      reviewCount = Number(rev?.totalReviews ?? rev?.total ?? list.length) || 0;
      averageRating = Number(rev?.averageRating ?? rev?.ratingAvg ?? 0) || 0;
    } catch { /* keep zeros */ }
    try {
      const qa = await bffGet(`/api/qa/${encodeURIComponent(id)}`);
      qaCount = unwrapList(qa, ['qa', 'items', 'data']).length;
    } catch { /* keep zero */ }
    res.set('Cache-Control', 'no-store');
    res.json({ ok: true, reviewCount, averageRating, qaCount, ts: Date.now() });
  });

  router.post('/:locale/product/:id/reviews', async (req, res) => {
    const locale = req.locale;
    const id = String(req.params.id || '');
    const path = bp(`/${locale}/product/${id}`);
    const { accessToken, refreshToken } = require('../session').readTokens(req);
    if (!accessToken && !refreshToken) {
      return res.redirect(
        `${bp(`/${locale}/auth/login`)}?next=${encodeURIComponent(path)}`,
      );
    }
    const rating = Math.round(Number(req.body.rating) || 0);
    const title = String(req.body.title || '').trim().slice(0, 120);
    const body = String(req.body.body || req.body.comment || '').trim().slice(0, 2000);
    const orderId = String(req.body.orderId || '').trim() || undefined;
    let imageUrls = [];
    try {
      const raw = req.body.imageUrls;
      imageUrls = Array.isArray(raw)
        ? raw
        : JSON.parse(String(raw || '[]'));
    } catch {
      imageUrls = String(req.body.imageUrls || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    imageUrls = imageUrls.filter((u) => typeof u === 'string' && /^https?:\/\//.test(u)).slice(0, 5);
    if (rating < 1 || rating > 5 || body.length < 5) {
      return res.redirect(
        `${path}?error=${encodeURIComponent(res.locals.t('reviewInvalid') || 'Please add a rating and review (5+ characters)')}#reviews`,
      );
    }
    try {
      const result = await authedFetch(req, res, '/api/reviews', {
        method: 'POST',
        body: {
          productId: id,
          rating,
          title: title || undefined,
          body,
          orderId,
          imageUrls,
        },
      });
      const edited = Boolean(result?.data?.review?.edited);
      const bonus = result?.data?.obPointsBonus || {};
      // #region agent log
      try {
        const fs = require('fs');
        const pathMod = require('path');
        fs.appendFileSync(
          pathMod.resolve(__dirname, '../../debug-1eb282.log'),
          `${JSON.stringify({
            sessionId: '1eb282',
            runId: 'review-edit',
            hypothesisId: 'H-LITE-REVIEW-EDIT',
            location: 'catalog.js:product/:id/reviews',
            message: edited ? 'lite review updated' : 'lite review submitted',
            data: {
              productId: id.slice(0, 12),
              rating,
              edited,
              hasOrderId: Boolean(orderId),
              bonusAwarded: Boolean(bonus.awarded),
            },
            timestamp: Date.now(),
          })}\n`,
        );
      } catch { /* ignore */ }
      // #endregion
      const notice = bonus.awarded
        ? (res.locals.t('reviewBonusNotice') || 'Thanks — your review is pending approval. +5 OB Points awarded.')
        : (res.locals.t('reviewPendingNotice') || 'Thanks — your review is pending approval');
      const q = new URLSearchParams();
      q.set('notice', notice);
      if (orderId) q.set('orderId', orderId);
      return res.redirect(`${path}?${q.toString()}#reviews`);
    } catch (err) {
      const msg = err.message || res.locals.t('errorGeneric');
      const q = new URLSearchParams();
      q.set('error', msg);
      if (orderId) q.set('orderId', orderId);
      return res.redirect(`${path}?${q.toString()}#reviews`);
    }
  });

  router.post('/:locale/product/:id/qa', async (req, res) => {
    const locale = req.locale;
    const id = String(req.params.id || '');
    const path = bp(`/${locale}/product/${id}`);
    const question = String(req.body.question || '').trim().slice(0, 1000);
    const askerName = String(req.body.askerName || '').trim().slice(0, 80);
    const askerEmail = String(req.body.askerEmail || '').trim().slice(0, 120);
    let imageUrls = [];
    try {
      const raw = req.body.imageUrls;
      imageUrls = Array.isArray(raw) ? raw : JSON.parse(String(raw || '[]'));
    } catch {
      imageUrls = String(req.body.imageUrls || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    imageUrls = imageUrls.filter((u) => typeof u === 'string' && /^https?:\/\//.test(u)).slice(0, 5);
    if (question.length < 5) {
      return res.redirect(
        `${path}?error=${encodeURIComponent(res.locals.t('qaInvalid') || 'Question must be at least 5 characters')}#qa`,
      );
    }
    const { accessToken, refreshToken } = require('../session').readTokens(req);
    try {
      const payload = {
        question,
        askerName: askerName || undefined,
        askerEmail: askerEmail || undefined,
        imageUrls,
      };
      if (accessToken || refreshToken) {
        await authedFetch(req, res, `/api/qa/${encodeURIComponent(id)}`, {
          method: 'POST',
          body: payload,
        });
      } else {
        await bffSend('POST', `/api/qa/${encodeURIComponent(id)}`, payload);
      }
      // #region agent log
      try {
        const fs = require('fs');
        const pathMod = require('path');
        fs.appendFileSync(
          pathMod.resolve(__dirname, '../../debug-1eb282.log'),
          `${JSON.stringify({
            sessionId: '1eb282',
            runId: 'lite-parity',
            hypothesisId: 'H-LITE-QA',
            location: 'catalog.js:product/:id/qa',
            message: 'lite QA submitted',
            data: { productId: id.slice(0, 12), qLen: question.length, authed: !!(accessToken || refreshToken) },
            timestamp: Date.now(),
          })}\n`,
        );
      } catch { /* ignore */ }
      // #endregion
      return res.redirect(
        `${path}?notice=${encodeURIComponent(res.locals.t('qaPendingNotice') || 'Question submitted — visible after approval')}#qa`,
      );
    } catch (err) {
      const msg = err.message || res.locals.t('errorGeneric');
      return res.redirect(`${path}?error=${encodeURIComponent(msg)}#qa`);
    }
  });

  // Form POST: add to cart (works without JS; guests use cookie cart)
  router.post('/:locale/cart/add', async (req, res) => {
    const locale = req.locale;
    const productId = String(req.body.productId || req.body.product_id || '');
    const quantity = Math.max(1, Number(req.body.quantity) || 1);
    const variantId = req.body.variantId || undefined;
    const buyNow = String(req.body.buyNow || '') === '1';
    const next = req.body.next || bp(`/${locale}/cart`);

    if (!productId) {
      return res.redirect(`${bp(`/${locale}/cart`)}?error=${encodeURIComponent('Missing product')}`);
    }

    const { accessToken, refreshToken } = require('../session').readTokens(req);
    if (!accessToken && !refreshToken) {
      const { resolveProductForGuest } = require('./cart');
      const {
        readGuestCart,
        writeGuestCart,
        addGuestItem,
      } = require('../guestCart');
      const resolved = await resolveProductForGuest(productId, locale);
      if (!resolved) {
        return res.redirect(
          `${bp(`/${locale}/product/${productId}`)}?error=${encodeURIComponent('Product not found')}`,
        );
      }
      const guest = addGuestItem(readGuestCart(req), {
        productId,
        variantId,
        quantity,
        unitPrice: resolved.unitPrice,
        name: resolved.name,
        image: resolved.image,
      });
      writeGuestCart(res, guest);
      // #region agent log
      try {
        const fs = require('fs');
        const path = require('path');
        fs.appendFileSync(
          path.resolve(__dirname, '../../debug-1eb282.log'),
          `${JSON.stringify({
            sessionId: '1eb282',
            runId: 'pre-fix',
            hypothesisId: 'H10',
            location: 'catalog.js:cart/add',
            message: 'lite guest add to cart',
            data: { productId: productId.slice(0, 12), qty: quantity, lines: guest.items.length, buyNow },
            timestamp: Date.now(),
          })}\n`,
        );
      } catch { /* ignore */ }
      // #endregion
      if (buyNow) {
        return res.redirect(
          `${bp(`/${locale}/auth/login`)}?next=${encodeURIComponent(bp(`/${locale}/checkout`))}`,
        );
      }
      if (String(req.headers['x-requested-with'] || '').toLowerCase() === 'xmlhttprequest') {
        return res.json({ ok: true, guest: true, itemCount: guest.items.length });
      }
      return res.redirect(
        next.includes('?')
          ? `${next}&flash=${encodeURIComponent(res.locals.t('addedToCart'))}`
          : `${next}?flash=${encodeURIComponent(res.locals.t('addedToCart'))}`,
      );
    }

    try {
      await authedFetch(req, res, '/api/cart/add', {
        method: 'POST',
        body: { productId, quantity, variantId },
      });
    } catch (err) {
      const msg = err.message || res.locals.t('errorGeneric');
      if (buyNow) {
        return res.redirect(
          `${bp(`/${locale}/product/${productId}`)}?error=${encodeURIComponent(msg)}`,
        );
      }
      const ref = req.headers.referer || bp(`/${locale}/product/${productId}`);
      return res.redirect(
        ref.includes('?')
          ? `${ref}&error=${encodeURIComponent(msg)}`
          : `${ref}?error=${encodeURIComponent(msg)}`,
      );
    }

    if (buyNow) return res.redirect(bp(`/${locale}/checkout`));
    if (String(req.headers['x-requested-with'] || '').toLowerCase() === 'xmlhttprequest') {
      return res.json({ ok: true });
    }
    return res.redirect(
      next.includes('?')
        ? `${next}&flash=${encodeURIComponent(res.locals.t('addedToCart'))}`
        : `${next}?flash=${encodeURIComponent(res.locals.t('addedToCart'))}`,
    );
  });
}

async function renderProductList(req, res, filters, extras = {}) {
  const locale = req.locale;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = 24;
  const sort = String(req.query.sort || 'newest');
  const query = {
    lang: locale,
    page,
    limit,
    sort,
    ...filters,
  };
  if (req.query.category) query.category = req.query.category;
  if (req.query.brands) query.brands = req.query.brands;
  if (req.query.trustBadge) query.trustBadge = req.query.trustBadge;

  let data = { products: [], pagination: {} };
  try {
    data = await bffGet('/api/products', query);
  } catch {
    data = { products: [], pagination: {} };
  }

  const products = unwrapList(data, ['products', 'items', 'data']);
  const pagination = paginationMeta(data.pagination, page, limit);

  let categories = [];
  try {
    categories = unwrapList(await bffGet('/api/categories'), ['categories', 'data']);
  } catch {
    categories = [];
  }

  res.render(extras.view || 'products', {
    title: extras.title || res.locals.t('products'),
    products,
    pagination,
    categories,
    sort,
    filters,
    searchQuery: extras.searchQuery || '',
    collection: filters.collection || '',
    categoryId: filters.category || req.query.category || '',
    trending: extras.trending || [],
  });
}

module.exports = { mountCatalog };
