const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '..', '..', 'frontend', 'lib', 'policies.ts');
const outPath = path.join(__dirname, '..', 'src', 'content', 'policies.js');
const src = fs.readFileSync(srcPath, 'utf8');

const enStart = src.indexOf('const EN_POLICIES');
const bnStart = src.indexOf('const BN_POLICIES');
const orderStart = src.indexOf('export const POLICY_ORDER');

const enBlock = src
  .slice(enStart, bnStart)
  .replace('const EN_POLICIES: Record<PolicyKey, PolicyDocument>', 'const EN_POLICIES');
const bnBlock = src
  .slice(bnStart, orderStart)
  .replace('const BN_POLICIES: Record<PolicyKey, PolicyDocument>', 'const BN_POLICIES');

const js = `${enBlock}${bnBlock}
const POLICY_ORDER = ['privacy', 'returns', 'refunds', 'shipping', 'terms', 'warranty'];

function getPolicies(locale) {
  return locale === 'bn' ? BN_POLICIES : EN_POLICIES;
}

function getPolicy(locale, slug) {
  const aliases = {
    'privacy-policy': 'privacy',
    'return-policy': 'returns',
    'terms-and-conditions': 'terms',
    'refund-policy': 'refunds',
    'shipping-policy': 'shipping',
    'warranty-policy': 'warranty',
  };
  const key = aliases[slug] || slug;
  const docs = getPolicies(locale);
  return docs[key] || null;
}

module.exports = { POLICY_ORDER, getPolicies, getPolicy };
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, js);

const p = require(outPath);
console.log('ok', Object.keys(p.getPolicies('en')), p.getPolicies('bn').terms.title);
