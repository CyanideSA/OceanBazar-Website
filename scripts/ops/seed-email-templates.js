#!/usr/bin/env node
/**
 * Upsert OceanBazar default email templates into EmailTemplate via Prisma.
 *
 * Run inside BFF (cwd /app, DATABASE_URL set):
 *   node /tmp/seed-email-templates.js
 *
 * From repo (backend has @prisma/client):
 *   cd backend && node ../scripts/ops/seed-email-templates.js
 *
 * Stable ids: default-<category> so re-runs update in place.
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');

function findTemplateTs() {
  const candidates = [
    path.join(__dirname, '../../backend/src/data/oceanbazarEmailTemplates.ts'),
    path.join(process.cwd(), 'src/data/oceanbazarEmailTemplates.ts'),
    path.join(process.cwd(), 'backend/src/data/oceanbazarEmailTemplates.ts'),
    '/app/src/data/oceanbazarEmailTemplates.ts',
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

/** Load data-only TS module without a full TypeScript toolchain. */
function loadTemplatesFromTs(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  code = code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/export\s+type\s+\w+\s*=\s*\{[\s\S]*?\};/g, '')
    .replace(/export\s+const\s+(\w+)\s*:\s*[^=]+=/g, 'const $1 =')
    .replace(/export\s+const\s+(\w+)\s*=/g, 'const $1 =')
    .replace(/as\s+const/g, '');
  const module = { exports: {} };
  // eslint-disable-next-line no-new-func
  Function('module', 'exports', 'require', `${code}\nmodule.exports = { OCEANBAZAR_EMAIL_TEMPLATES };`)(
    module,
    module.exports,
    require,
  );
  const list = module.exports.OCEANBAZAR_EMAIL_TEMPLATES;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('OCEANBAZAR_EMAIL_TEMPLATES missing or empty');
  }
  return list;
}

function loadViaNodeStripTypes(filePath) {
  const script = `
    import { pathToFileURL } from 'url';
    const mod = await import(pathToFileURL(${JSON.stringify(filePath)}).href);
    process.stdout.write(JSON.stringify(mod.OCEANBAZAR_EMAIL_TEMPLATES || []));
  `;
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || 'strip-types import failed');
  }
  const list = JSON.parse(result.stdout);
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('OCEANBAZAR_EMAIL_TEMPLATES missing or empty');
  }
  return list;
}

async function loadTemplates() {
  const tsPath = findTemplateTs();
  if (!tsPath) {
    throw new Error(
      'Could not find oceanbazarEmailTemplates.ts — copy backend/src/data into the BFF container or run from repo root.',
    );
  }

  try {
    return loadViaNodeStripTypes(tsPath);
  } catch (err) {
    console.warn('[seed-email-templates] strip-types load failed:', err.message);
  }

  try {
    return loadTemplatesFromTs(tsPath);
  } catch (err) {
    console.warn('[seed-email-templates] TS strip load failed:', err.message);
  }

  try {
    const mod = await import(pathToFileURL(tsPath).href);
    if (Array.isArray(mod.OCEANBAZAR_EMAIL_TEMPLATES)) return mod.OCEANBAZAR_EMAIL_TEMPLATES;
  } catch (err) {
    console.warn('[seed-email-templates] dynamic import failed:', err.message);
  }

  throw new Error(`Could not load templates from ${tsPath}`);
}

async function main() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const templates = await loadTemplates();
  const results = [];

  try {
    for (const tpl of templates) {
      const id = `default-${tpl.category}`;
      const data = {
        name: tpl.name,
        subject: tpl.subject,
        bodyHtml: tpl.bodyHtml,
        category: tpl.category,
        variables: tpl.variables || [],
        designJson: null,
        updatedBy: 'seed-email-templates',
      };
      const row = await prisma.emailTemplate.upsert({
        where: { id },
        create: { id, ...data },
        update: data,
      });
      results.push({ id: row.id, category: row.category, name: row.name });
    }
    console.log(JSON.stringify({ ok: true, upserted: results.length, templates: results }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
