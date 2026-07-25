const fs = require('fs');
const path = require('path');

const LOCALES = ['bn', 'en'];
const DEFAULT_LOCALE = 'bn';

const cache = {};
for (const loc of LOCALES) {
  const file = path.join(__dirname, '..', 'locales', `${loc}.json`);
  cache[loc] = JSON.parse(fs.readFileSync(file, 'utf8'));
}

function isLocale(value) {
  return LOCALES.includes(value);
}

function t(locale, key) {
  const dict = cache[locale] || cache[DEFAULT_LOCALE];
  return dict[key] || cache.en[key] || key;
}

function makeT(locale) {
  return (key) => t(locale, key);
}

module.exports = { LOCALES, DEFAULT_LOCALE, isLocale, t, makeT };
