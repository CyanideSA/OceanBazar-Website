const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..', 'frontend', 'messages');
const outPath = path.join(__dirname, '..', 'src', 'content', 'pageCopy.js');

const en = JSON.parse(fs.readFileSync(path.join(root, 'en.json'), 'utf8'));
const bn = JSON.parse(fs.readFileSync(path.join(root, 'bn.json'), 'utf8'));

const namespaces = ['marketing', 'support', 'contact', 'business'];
const copy = { en: {}, bn: {} };
for (const ns of namespaces) {
  copy.en[ns] = en[ns];
  copy.bn[ns] = bn[ns];
}

const js = `/** Copied from frontend/messages — keep in sync when policy/marketing copy changes. */
const COPY = ${JSON.stringify(copy, null, 2)};

function getPageCopy(locale, namespace) {
  const loc = locale === 'bn' ? 'bn' : 'en';
  return (COPY[loc] && COPY[loc][namespace]) || (COPY.en && COPY.en[namespace]) || {};
}

module.exports = { getPageCopy, COPY };
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, js);
console.log('wrote pageCopy', Object.keys(copy.en));
