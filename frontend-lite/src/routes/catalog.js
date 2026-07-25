const express = require('express');
const { bffGet, BffError } = require('../bffClient');
const { unwrapList, paginationMeta, pickName } = require('../helpers');
const { authedFetch } = require('../session');

function mountCatalog(router) {
  router.get('/:locale', async (req, res) => {
    const locale = req.locale;
    const collections = [
      { key: 'featured', titleKey: 'featured', collection: 'featured' },
      { key: 'latest', titleKey: 'latest', collection: 'latest' },
      { key: 'best-deals', titleKey: 'bestDeals', collection: 'best-deals' },
      { key: 'top-trending', titleKey: 'topTrending', collection: 'top-trending' },
    ];

    const [categories, ...lists] = await Promise.all([
      bffGet('/api/categories').catch(() => ({ categories: [] })),
      ...collections.map((c) =>
        bffGet('/api/products', { lang: locale, collection: c.collection, limit: 8, page: 1 }).catch(
          () => ({ products: [] }),
        ),
      ),
    ]);

    const sections = collections.map((c, i) => ({
      ...c,
      products: unwrapList(lists[i], ['products', 'items', 'data']),
    }));

    const cats = unwrapList(categories, ['categories', 'data']);
    const heroSlides = Array.isArray(res.locals.settings?.heroSlides)
      ? res.locals.settings.heroSlides.slice(0, 3)
      : [];

    res.render('home', {
      title: res.locals.t('home'),
      sections,
      categories: cats.slice(0, 12),
      heroSlides,
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

  router.get('/:locale/search', async (req, res) => {
    const q = String(req.query.q || '').trim();
    await renderProductList(req, res, { search: q }, {
      view: 'search',
      title: q || res.locals.t('search'),
      searchQuery: q,
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
    const products = unwrapList(page?.products || page, ['products', 'items', 'data']);
    res.render('flash-deals', {
      title: res.locals.t('flashDeals'),
      page,
      products,
      sale: page?.sale || page?.activeSale || null,
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
    try {
      const rev = await bffGet(`/api/reviews/product/${encodeURIComponent(id)}`, {
        page: 1,
        sort: 'newest',
      });
      reviews = unwrapList(rev, ['reviews', 'items', 'data']).slice(0, 10);
    } catch {
      reviews = [];
    }

    const variants = Array.isArray(product.variants) ? product.variants : [];
    const images = [];
    const rawImgs = product.images || product.media || [];
    for (const img of rawImgs) {
      if (typeof img === 'string') images.push(img);
      else if (img?.url || img?.src) images.push(img.url || img.src);
    }
    if (!images.length && product.imageUrl) images.push(product.imageUrl);

    res.render('product', {
      title: pickName(product, locale),
      product,
      variants,
      images,
      reviews,
    });
  });

  // Form POST: add to cart (works without JS)
  router.post('/:locale/cart/add', async (req, res) => {
    const locale = req.locale;
    const productId = String(req.body.productId || '');
    const quantity = Math.max(1, Number(req.body.quantity) || 1);
    const variantId = req.body.variantId || undefined;
    const buyNow = String(req.body.buyNow || '') === '1';
    const next = req.body.next || `/${locale}/cart`;

    if (!productId) {
      return res.redirect(`/${locale}/cart?error=${encodeURIComponent('Missing product')}`);
    }

    const { accessToken, refreshToken } = require('../session').readTokens(req);
    if (!accessToken && !refreshToken) {
      return res.redirect(
        `/${locale}/auth/login?next=${encodeURIComponent(req.headers.referer || `/${locale}/product/${productId}`)}`,
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
        return res.redirect(`/${locale}/product/${productId}?error=${encodeURIComponent(msg)}`);
      }
      const ref = req.headers.referer || `/${locale}/product/${productId}`;
      return res.redirect(
        ref.includes('?')
          ? `${ref}&error=${encodeURIComponent(msg)}`
          : `${ref}?error=${encodeURIComponent(msg)}`,
      );
    }

    if (buyNow) return res.redirect(`/${locale}/checkout`);
    if (String(req.headers['x-requested-with'] || '').toLowerCase() === 'xmlhttprequest') {
      return res.json({ ok: true });
    }
    return res.redirect(next.includes('?')
      ? `${next}&flash=${encodeURIComponent(res.locals.t('addedToCart'))}`
      : `${next}?flash=${encodeURIComponent(res.locals.t('addedToCart'))}`);
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
    categoryId: filters.category || '',
  });
}

module.exports = { mountCatalog };
