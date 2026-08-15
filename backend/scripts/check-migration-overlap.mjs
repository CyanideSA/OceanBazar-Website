#!/usr/bin/env node
/**
 * Flags tables that appear in both Prisma schema and Flyway SQL migrations.
 * Prisma should own "commerce core" tables; Flyway should add Java-only tables or use
 * non-overlapping names. Run from repo root: node backend/scripts/check-migration-overlap.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const prismaSchema = path.join(repoRoot, 'backend', 'prisma', 'schema.prisma');
const flywayDir = path.join(repoRoot, 'backend-java', 'src', 'main', 'resources', 'db', 'migration');

function prismaTables() {
  const text = fs.readFileSync(prismaSchema, 'utf8');
  const tables = new Set();
  const re = /@@map\("([^"]+)"\)/g;
  let m;
  while ((m = re.exec(text))) tables.add(m[1]);
  return tables;
}

function flywaySqlFiles() {
  if (!fs.existsSync(flywayDir)) return [];
  return fs.readdirSync(flywayDir).filter((f) => f.endsWith('.sql')).map((f) => path.join(flywayDir, f));
}

function tablesMentionedInSql(sql) {
  const s = new Set();
  const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?([a-z0-9_]+)["`]?/gi;
  let m;
  while ((m = createRe.exec(sql))) s.add(m[1].toLowerCase());
  const alterRe = /ALTER\s+TABLE\s+(?:ONLY\s+)?["`]?([a-z0-9_]+)["`]?/gi;
  while ((m = alterRe.exec(sql))) s.add(m[1].toLowerCase());
  return s;
}

const prisma = prismaTables();
const flywayTables = new Set();
for (const file of flywaySqlFiles()) {
  const sql = fs.readFileSync(file, 'utf8');
  for (const t of tablesMentionedInSql(sql)) flywayTables.add(t);
}

const overlap = [...prisma].filter((t) => flywayTables.has(t.toLowerCase()));

console.log(`Prisma @@map tables: ${prisma.size}`);
console.log(`Flyway referenced tables (create/alter): ${flywayTables.size}`);
if (overlap.length === 0) {
  console.log('No overlapping table names detected (heuristic).');
  process.exit(0);
}

console.log('\n⚠ Overlap (review single authority per table):\n');
for (const t of overlap.sort()) console.log(`  - ${t}`);
console.log('\nSet MIGRATION_OVERLAP_STRICT=1 to fail CI on overlaps.\n');
if (process.env.MIGRATION_OVERLAP_STRICT === '1') process.exit(2);
process.exit(0);
