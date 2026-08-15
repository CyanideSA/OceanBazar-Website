const path = require('path');
const express = require('express');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const morgan = require('morgan');

const preferRouter = require('./routes/prefer');
const { localeRouter, DEFAULT_LOCALE } = require('./middleware/locale');
const { mountCatalog } = require('./routes/catalog');
const { mountCart } = require('./routes/cart');
const { mountCheckout } = require('./routes/checkout');
const { mountAuth } = require('./routes/auth');
const { mountAccount } = require('./routes/account');
const { mountInfo } = require('./routes/info');
const { mountServices } = require('./routes/services');
const { mountPathao } = require('./routes/pathao');
const { BASE_PATH, bp } = require('./config');

const PORT = Number(process.env.PORT || 3001);
const app = express();

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Docker / nginx health (no prefix)
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'oceanbazar-web-lite', basePath: BASE_PATH || '/' });
});

const root = express.Router();

root.use(
  express.static(path.join(__dirname, '..', 'public'), {
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
    etag: true,
  }),
);

root.use(preferRouter);

root.get('/', (_req, res) => {
  res.redirect(302, bp(`/${DEFAULT_LOCALE}`));
});

const shop = localeRouter((router) => {
  mountCatalog(router);
  mountCart(router);
  mountCheckout(router);
  mountPathao(router);
  mountAuth(router);
  mountServices(router);
  mountInfo(router);
  mountAccount(router);
});

root.use(shop);

root.use((err, req, res, _next) => {
  console.error('[lite]', err);
  const locale = req.locale || DEFAULT_LOCALE;
  if (res.headersSent) return;
  res.status(err.status || 500).render('error', {
    title: 'Error',
    message: err.message || 'Something went wrong',
    locale,
    t: (k) => k,
    helpers: require('./helpers'),
    bp,
    basePath: BASE_PATH,
    settings: {},
    user: null,
    cartCount: 0,
    flash: null,
    flashCountdown: '',
    flashMs: 0,
    fullSiteOrigin: process.env.FULL_SITE_ORIGIN || 'https://oceanbazar.com.bd',
    liteOrigin: '',
    flashMsg: '',
    errorMsg: '',
    path: req.path,
    query: {},
    year: new Date().getFullYear(),
    locales: ['bn', 'en'],
  });
});

root.use((req, res) => {
  const locale = req.locale || DEFAULT_LOCALE;
  res.status(404).render('error', {
    title: '404',
    message: 'Page not found',
    locale,
    t: (k) => k,
    helpers: require('./helpers'),
    bp,
    basePath: BASE_PATH,
    settings: {},
    user: null,
    cartCount: 0,
    flash: null,
    flashCountdown: '',
    flashMs: 0,
    fullSiteOrigin: process.env.FULL_SITE_ORIGIN || 'https://oceanbazar.com.bd',
    liteOrigin: '',
    flashMsg: '',
    errorMsg: '',
    path: req.path,
    query: {},
    year: new Date().getFullYear(),
    locales: ['bn', 'en'],
  });
});

if (BASE_PATH) {
  app.use(BASE_PATH, root);
  app.get('/', (_req, res) => res.redirect(302, bp(`/${DEFAULT_LOCALE}`)));
} else {
  app.use(root);
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`oceanbazar-web-lite listening on :${PORT} basePath=${BASE_PATH || '/'}`);
});
