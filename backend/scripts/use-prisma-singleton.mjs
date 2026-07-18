/**
 * Codemod: replace per-file `new PrismaClient()` with shared `import { prisma } from '.../lib/prisma'`.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', 'src');
const PRISMA_FILE = path.join(SRC, 'lib', 'prisma.ts');

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.ts') && p !== PRISMA_FILE) out.push(p);
  }
  return out;
}

function relImport(fromFile) {
  let rel = path.relative(path.dirname(fromFile), path.join(SRC, 'lib', 'prisma')).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

let changed = 0;
for (const file of walk(SRC)) {
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('new PrismaClient(')) continue;

  const before = src;
  src = src.replace(/^[ \t]*const prisma = new PrismaClient\(\);[ \t]*\r?\n/gm, '');

  // Strip PrismaClient from @prisma/client imports when unused afterward
  src = src.replace(
    /import\s*\{([^}]+)\}\s*from\s*['"]@prisma\/client['"]\s*;?/g,
    (full, inner) => {
      const parts = inner
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((name) => name !== 'PrismaClient' && !name.startsWith('PrismaClient '));
      if (parts.length === 0) return '';
      return `import { ${parts.join(', ')} } from '@prisma/client';`;
    }
  );

  // Drop bare `import { PrismaClient } from ...` leftovers / blank-only lines from removal
  src = src.replace(/\n{3,}/g, '\n\n');

  if (!/import\s*\{[^}]*\bprisma\b[^}]*\}\s*from\s*['"].*lib\/prisma['"]/.test(src)) {
    const imp = `import { prisma } from '${relImport(file)}';\n`;
    // Insert after the last leading import block
    const importBlock = src.match(/^(?:(?:import[\s\S]*?;|\/\*[\s\S]*?\*\/|\/\/[^\n]*)\r?\n)*/);
    if (importBlock) {
      const end = importBlock[0].length;
      src = src.slice(0, end) + imp + src.slice(end);
    } else {
      src = imp + src;
    }
  }

  if (src !== before) {
    fs.writeFileSync(file, src);
    changed++;
    console.log('updated', path.relative(SRC, file));
  }
}

console.log(`done: ${changed} files`);
