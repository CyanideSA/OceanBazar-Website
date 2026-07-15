#!/usr/bin/env node
/**
 * Cross-validates Prisma schema (source of truth for shared tables) against Flyway SQL.
 * Compares only additive Flyway ALTERs and Java-only CREATEs — not legacy V3 bootstrap DDL.
 *
 * Usage (repo root):
 *   node scripts/ops/verify-schema-prisma-flyway.mjs
 * Env:
 *   SCHEMA_VERIFY_STRICT=0 — warn only (local dev)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const prismaPath = path.join(repoRoot, 'backend', 'prisma', 'schema.prisma');
const flywayDir = path.join(repoRoot, 'backend-java', 'src', 'main', 'resources', 'db', 'migration');
const strict = process.env.SCHEMA_VERIFY_STRICT !== '0';

/** Java-only tables Flyway may own exclusively (not in Prisma). */
const FLYWAY_ONLY_TABLES = new Set([
  'flyway_schema_history',
  'inventory_items',
  'inventory_reservations',
  'inventory_transactions',
  'file_explorer_nodes',
  'spring_session',
]);

/** Columns present in legacy Flyway bootstrap but refactored in Prisma (e.g. M:N category map). */
const LEGACY_FLYWAY_COLUMNS = new Map([
  ['products', new Set(['category_id'])],
]);

const SQL_KEYWORD_COLS = new Set([
  'if', 'not', 'exists', 'then', 'else', 'end', 'begin', 'do', 'when', 'case',
  'constraint', 'primary', 'foreign', 'unique', 'check', 'references', 'default',
]);

function parsePrismaModels(text) {
  /** @type {Map<string, Map<string, string>>} */
  const tables = new Map();
  const modelBlocks = text.split(/\nmodel\s+/).slice(1);
  for (const block of modelBlocks) {
    const nameMatch = block.match(/^(\w+)\s*\{/);
    if (!nameMatch) continue;
    const body = block.slice(block.indexOf('{') + 1, block.lastIndexOf('}'));
    const mapMatch = body.match(/@@map\("([^"]+)"\)/);
    const tableName = (mapMatch ? mapMatch[1] : nameMatch[1]).toLowerCase();
    /** @type {Map<string, string>} */
    const columns = new Map();
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@') || trimmed.startsWith('}')) continue;
      const fieldMatch = trimmed.match(/^(\w+)\s+(\w+)/);
      if (!fieldMatch) continue;
      const [, field, pType] = fieldMatch;
      if (['model', 'enum'].includes(pType)) continue;
      const colMap = trimmed.match(/@map\("([^"]+)"\)/);
      const colName = (colMap ? colMap[1] : field).toLowerCase();
      const dbType = trimmed.match(/@db\.(\w+)(?:\(([^)]+)\))?/);
      let sqlType;
      if (dbType) {
        const [, kind, args] = dbType;
        if (kind === 'Char' && args) sqlType = `char(${args})`;
        else if (kind === 'VarChar') sqlType = args ? `varchar(${args})` : 'varchar';
        else if (kind === 'Decimal') sqlType = 'numeric';
        else if (kind === 'Timestamptz') sqlType = 'timestamptz';
        else sqlType = kind.toLowerCase();
      } else {
        const baseType = pType.replace(/\?|\[\]/g, '');
        sqlType =
          baseType === 'String'
            ? 'text'
            : baseType === 'Int'
              ? 'integer'
              : baseType === 'BigInt'
                ? 'bigint'
                : baseType === 'Boolean'
                  ? 'boolean'
                  : baseType === 'Decimal'
                    ? 'numeric'
                    : baseType === 'DateTime'
                      ? 'timestamptz'
                      : baseType === 'Json'
                        ? 'jsonb'
                        : baseType.toLowerCase();
      }
      columns.set(colName, normalizeSqlType(sqlType));
    }
    tables.set(tableName, columns);
  }
  return tables;
}

function collectFlywaySql() {
  if (!fs.existsSync(flywayDir)) return '';
  return fs
    .readdirSync(flywayDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => fs.readFileSync(path.join(flywayDir, f), 'utf8'))
    .join('\n');
}

function parseFlywayAlterColumns(sql) {
  /** @type {Map<string, Map<string, string>>} */
  const tables = new Map();

  const alterRe =
    /ALTER\s+TABLE\s+(?:"?(\w+)"?)\s+ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?\s+([\w\s(),.]+?)(?:\s*,|\s*;|\s+CONSTRAINT|\s+REFERENCES)/gi;
  let m;
  while ((m = alterRe.exec(sql))) {
    const table = m[1].toLowerCase();
    const col = m[2].toLowerCase();
    if (SQL_KEYWORD_COLS.has(col)) continue;
    const type = normalizeSqlType(extractSqlType(m[3]));
    if (!tables.has(table)) tables.set(table, new Map());
    tables.get(table).set(col, type);
  }

  // Java-only CREATE TABLE (inventory, spring_session, etc.)
  const createRe =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?(\w+)"?)\s*\(([\s\S]*?)\)\s*;/gi;
  while ((m = createRe.exec(sql))) {
    const table = m[1].toLowerCase();
    if (!FLYWAY_ONLY_TABLES.has(table)) continue;
    const body = m[2];
    /** @type {Map<string, string>} */
    const cols = new Map();
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('--')) continue;
      const col = trimmed.match(/^"?(\w+)"?\s+([\w\s().,]+)/i);
      if (!col) continue;
      const name = col[1].toLowerCase();
      if (SQL_KEYWORD_COLS.has(name)) continue;
      cols.set(name, normalizeSqlType(extractSqlType(col[2])));
    }
    tables.set(table, cols);
  }

  return tables;
}

function extractSqlType(fragment) {
  const s = String(fragment).toLowerCase().trim();
  const m = s.match(/^(char|varchar|text|int|integer|bigint|boolean|bool|numeric|decimal|timestamptz|timestamp|jsonb|json|uuid|serial|bigserial)(?:\s*\([^)]*\))?/);
  return m ? m[0].replace(/\s+/g, '') : s.split(/\s+/)[0];
}

function normalizeSqlType(t) {
  const raw = String(t).toLowerCase().replace(/\s+/g, '');
  if (raw.startsWith('char(') || raw.startsWith('varchar(') || raw === 'varchar' || raw === 'text' || raw === 'char') {
    return 'text';
  }
  if (raw === 'int' || raw === 'integer' || raw === 'serial' || raw.startsWith('serial')) return 'integer';
  if (raw === 'bigint' || raw.startsWith('bigserial')) return 'bigint';
  if (raw === 'bool' || raw === 'boolean') return 'boolean';
  if (raw.includes('numeric') || raw.includes('decimal')) return 'numeric';
  if (raw.includes('timestamp')) return 'timestamptz';
  if (raw === 'json' || raw === 'jsonb') return 'jsonb';
  if (raw === 'uuid') return 'uuid';
  return raw;
}

function typesCompatible(prismaType, sqlType) {
  if (prismaType === sqlType) return true;
  if (prismaType === 'text' && sqlType === 'text') return true;
  if (prismaType === 'integer' && (sqlType === 'integer' || sqlType === 'bigint')) return true;
  if (prismaType === 'timestamptz' && sqlType === 'timestamptz') return true;
  if (prismaType === 'numeric' && sqlType === 'numeric') return true;
  if (prismaType === 'jsonb' && (sqlType === 'jsonb' || sqlType === 'json')) return true;
  return false;
}

const prismaTables = parsePrismaModels(fs.readFileSync(prismaPath, 'utf8'));
const flywaySql = collectFlywaySql();
const flywayTables = parseFlywayAlterColumns(flywaySql);

const errors = [];
const warnings = [];

for (const [table, flyCols] of flywayTables) {
  if (FLYWAY_ONLY_TABLES.has(table)) continue;
  const prismaCols = prismaTables.get(table);
  if (!prismaCols) {
    warnings.push(`Flyway ALTER on table not mapped in Prisma: ${table}`);
    continue;
  }
  const legacyCols = LEGACY_FLYWAY_COLUMNS.get(table) ?? new Set();
  for (const [col, sqlType] of flyCols) {
    if (legacyCols.has(col)) continue;
    const prismaType = prismaCols.get(col);
    if (!prismaType) {
      errors.push(`Column "${table}.${col}" added in Flyway but missing in Prisma`);
      continue;
    }
    if (!typesCompatible(prismaType, sqlType)) {
      errors.push(`Type mismatch "${table}.${col}": Prisma=${prismaType}, Flyway=${sqlType}`);
    }
  }
}

console.log(`Prisma tables: ${prismaTables.size}`);
console.log(`Flyway additive columns checked: ${[...flywayTables.values()].reduce((n, m) => n + m.size, 0)}`);

if (warnings.length) {
  console.log('\nWarnings:');
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}

if (errors.length) {
  console.error('\nSchema verification FAILED:\n');
  for (const e of errors) console.error(`  ✗ ${e}`);
  if (strict) process.exit(2);
  process.exit(1);
}

console.log('\nSchema verification passed (Prisma ↔ Flyway additive DDL).');
process.exit(0);
