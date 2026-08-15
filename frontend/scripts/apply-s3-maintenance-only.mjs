/**
 * After `next build` static export (./out), replace every HTML file with the
 * pre-rendered maintenance pages so S3/CloudFront visitors only see maintenance.
 *
 * Usage: node scripts/apply-s3-maintenance-only.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(__dirname, '..', 'out');

const enPath = path.join(out, 'en', 'maintenance.html');
const bnPath = path.join(out, 'bn', 'maintenance.html');

if (!fs.existsSync(out)) {
  console.error('Missing frontend/out — run: npm run build:s3:maintenance');
  process.exit(1);
}
if (!fs.existsSync(enPath) || !fs.existsSync(bnPath)) {
  console.error('Missing en/maintenance.html or bn/maintenance.html in out/.');
  console.error('Ensure app/[locale]/(status)/maintenance is included in the static export.');
  process.exit(1);
}

const enHtml = fs.readFileSync(enPath, 'utf8');
const bnHtml = fs.readFileSync(bnPath, 'utf8');

function pickHtml(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  if (norm === 'index.html') return bnHtml;
  if (norm.startsWith('bn/') || norm === 'bn.html') return bnHtml;
  return enHtml;
}

let replaced = 0;
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === '_next') continue;
      walk(abs);
      continue;
    }
    if (!ent.name.endsWith('.html')) continue;
    const rel = path.relative(out, abs);
    fs.writeFileSync(abs, pickHtml(rel), 'utf8');
    replaced += 1;
  }
}

walk(out);
fs.writeFileSync(path.join(out, 'index.html'), bnHtml, 'utf8');

console.log(`✓ Maintenance-only S3 surface: ${replaced} HTML file(s) normalized (default locale: bn).`);
console.log('  Locale URLs: /en/maintenance.html and /bn/maintenance.html');
