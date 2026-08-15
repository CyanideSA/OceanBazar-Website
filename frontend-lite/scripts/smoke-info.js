const path = require('path');
const express = require('express');
const { getPolicy, getPolicies, POLICY_ORDER } = require('../src/content/policies');
const { getPageCopy } = require('../src/content/pageCopy');
const { makeT } = require('../src/i18n');

const checks = [];
function ok(name, cond) {
  checks.push({ name, ok: !!cond });
  if (!cond) console.error('FAIL', name);
}

ok('policies en privacy', !!getPolicy('en', 'privacy'));
ok('policies bn terms', !!getPolicy('bn', 'terms'));
ok('alias privacy-policy', !!getPolicy('en', 'privacy-policy'));
ok('policy order', POLICY_ORDER.length === 6);
ok('marketing copy', !!getPageCopy('bn', 'marketing').heroTitle);
ok('support copy', !!getPageCopy('en', 'support').title);
ok('contact copy', !!getPageCopy('bn', 'contact').title);
ok('business copy', !!getPageCopy('en', 'business').feat1Title);
ok('i18n allProducts', makeT('bn')('allProducts') === 'সব পণ্য');
ok('i18n mostSold', makeT('en')('mostSold') === 'Most Sold');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

const locals = {
  locale: 'bn',
  locales: ['bn', 'en'],
  t: makeT('bn'),
  helpers: require('../src/helpers'),
  bp: (p) => `/lite${p}`,
  basePath: '/lite',
  user: null,
  settings: { supportEmail: 'contact@oceanbazar.com.bd', supportPhone: '01XXXXXXXXX' },
  flash: null,
  flashCountdown: '',
  flashMs: 0,
  cartCount: 0,
  navCategories: [],
  fullSiteOrigin: 'https://oceanbazar.com.bd',
  liteOrigin: 'https://oceanbazar.com.bd/lite',
  flashMsg: '',
  errorMsg: '',
  path: '/bn',
  query: {},
  year: 2026,
};

app.render('policy', {
  ...locals,
  title: 'Privacy',
  doc: getPolicies('bn').privacy,
  policyOrder: POLICY_ORDER,
  policies: getPolicies('bn'),
  slug: 'privacy',
}, (err, html) => {
  ok('render policy', !err && html.includes('প্রাইভেসি'));
  if (err) console.error(err);
  app.render('marketing', { ...locals, title: 'Why', copy: getPageCopy('bn', 'marketing') }, (err2, html2) => {
    ok('render marketing', !err2 && html2.includes('OceanBazar'));
    if (err2) console.error(err2);
    const failed = checks.filter((c) => !c.ok);
    console.log(checks.map((c) => `${c.ok ? '✓' : '✗'} ${c.name}`).join('\n'));
    process.exit(failed.length ? 1 : 0);
  });
});
