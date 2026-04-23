/**
 * Walks "All Categories (Demo)" folder tree and emits catalog JSON + CSV.
 * Usage: node scripts/parse-demo-categories.mjs "C:\\path\\to\\All Categories (Demo)"
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120) || 'x';
}

function idFrom(parts) {
  const h = crypto.createHash('sha1').update(parts.join('|')).digest('hex');
  return h.slice(0, 12);
}

function isImage(file) {
  return IMAGE_EXT.has(path.extname(file).toLowerCase());
}

function readDir(d) {
  try {
    return fs.readdirSync(d, { withFileTypes: true });
  } catch {
    return [];
  }
}

function walk(rootAbs, relParts, out) {
  const abs = path.join(rootAbs, ...relParts);
  const entries = readDir(abs);
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  const files = entries.filter((e) => e.isFile()).map((e) => e.name);
  const images = files.filter(isImage);
  const rel = relParts.join('/');

  const hasOnlyImages = images.length > 0 && dirs.length === 0;
  const hasOnlyDirs = dirs.length > 0 && images.length === 0;
  const mixed = images.length > 0 && dirs.length > 0;

  if (hasOnlyImages) {
    const productName = relParts[relParts.length - 1] || 'Product';
    const catParts = relParts.slice(0, -1);
    const categoryPath = catParts.join(' > ');
    const productId = idFrom(['product', abs]);
    const primaryImage = images.sort()[0];
    out.products.push({
      id: productId,
      name: productName,
      categoryPath,
      folderRelative: rel,
      imageCount: images.length,
      primaryImage: path.join(rel, primaryImage).replace(/\\/g, '/'),
    });
    for (const img of images.sort()) {
      out.media.push({
        id: idFrom(['media', abs, img]),
        productId,
        relativePath: path.join(rel, img).replace(/\\/g, '/'),
        fileName: img,
        role: img === primaryImage ? 'primary' : 'gallery',
      });
    }
    const tagSet = new Set();
    for (const part of relParts) {
      part
        .split(/[,&\-–—/|]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((t) => {
          const sl = slug(t);
          if (sl.length > 2) tagSet.add(sl);
        });
    }
    for (const t of tagSet) {
      out.productTags.push({ productId, tagSlug: t });
    }
    return;
  }

  if (mixed) {
    const productName = relParts[relParts.length - 1] || 'Product';
    const catParts = relParts.slice(0, -1);
    const categoryPath = catParts.join(' > ');
    const productId = idFrom(['product', abs]);
    const primaryImage = images.sort()[0];
    out.products.push({
      id: productId,
      name: productName,
      categoryPath,
      folderRelative: rel,
      imageCount: images.length,
      primaryImage: path.join(rel, primaryImage).replace(/\\/g, '/'),
      note: 'folder_has_subdirs_and_images',
    });
    for (const img of images.sort()) {
      out.media.push({
        id: idFrom(['media', abs, img]),
        productId,
        relativePath: path.join(rel, img).replace(/\\/g, '/'),
        fileName: img,
        role: img === primaryImage ? 'primary' : 'gallery',
      });
    }
    for (const d of dirs) {
      walk(rootAbs, [...relParts, d], out);
    }
    return;
  }

  for (const d of dirs) {
    walk(rootAbs, [...relParts, d], out);
  }
}

function isProductLeafDir(abs) {
  const entries = readDir(abs);
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  const images = entries.filter((e) => e.isFile() && isImage(e.name)).map((e) => e.name);
  return images.length > 0 && dirs.length === 0;
}

function buildCategoryTree(rootAbs, rootName) {
  const categories = [];
  const subcategories = [];
  const seen = new Map();

  function ensureCategory(relParts, depth) {
    const key = relParts.join('/');
    if (seen.has(key)) return seen.get(key);
    const name = relParts[relParts.length - 1];
    const parentParts = relParts.slice(0, -1);
    const parentKey = parentParts.join('/');
    const parentId = parentParts.length === 0 ? null : seen.get(parentKey)?.id ?? null;
    const id = idFrom(['cat', rootAbs, key]);
    const row = {
      id,
      name,
      slug: slug(name),
      depth,
      parentId,
      path: key,
    };
    seen.set(key, row);
    if (depth === 1) {
      categories.push(row);
    } else {
      subcategories.push(row);
    }
    return row;
  }

  function walkDirs(relParts) {
    const abs = path.join(rootAbs, ...relParts);
    const entries = readDir(abs);
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    if (relParts.length === 0) {
      for (const d of dirs) {
        const childAbs = path.join(abs, d);
        if (isProductLeafDir(childAbs)) continue;
        ensureCategory([d], 1);
        walkDirs([d]);
      }
      return;
    }
    const depth = relParts.length;
    ensureCategory(relParts, depth);
    for (const d of dirs) {
      const childAbs = path.join(abs, d);
      if (isProductLeafDir(childAbs)) continue;
      walkDirs([...relParts, d]);
    }
  }

  walkDirs([]);
  return { categories, subcategories, seen };
}

function tagsFromTree(subcategories, products) {
  const tags = new Map();
  for (const s of subcategories) {
    const parts = s.name.split(/[,&\-–—/|]+/).map((x) => x.trim()).filter(Boolean);
    for (const p of parts) {
      const sl = slug(p);
      if (sl.length < 3) continue;
      if (!tags.has(sl)) tags.set(sl, { slug: sl, label: p, source: 'folder_name' });
    }
  }
  for (const pr of products) {
    const parts = pr.name.split(/[,&\-–—/|]+/).map((x) => x.trim()).filter(Boolean);
    for (const p of parts) {
      const sl = slug(p);
      if (sl.length < 3) continue;
      if (!tags.has(sl)) tags.set(sl, { slug: sl, label: p, source: 'product_name' });
    }
  }
  return [...tags.values()];
}

function brandsPlaceholder() {
  return [
    {
      id: idFrom(['brand', 'unassigned']),
      name: '(Inferred from listing — add brand per product in admin)',
      slug: 'unassigned',
      note: 'No brand folders in demo tree; map manually or extend parser.',
    },
  ];
}

function toCsv(rows, columns) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.join(',');
  const lines = rows.map((r) => columns.map((c) => esc(r[c])).join(','));
  return [header, ...lines].join('\r\n');
}

function main() {
  const demoRoot = process.argv[2] || process.env.DEMO_CATEGORIES_ROOT;
  if (!demoRoot || !fs.existsSync(demoRoot)) {
    console.error('Usage: node scripts/parse-demo-categories.mjs <absolute-path-to-demo-folder>');
    process.exit(1);
  }

  const rootAbs = path.resolve(demoRoot);
  const outDir = path.join(process.cwd(), 'data', 'demo-catalog-parse');
  fs.mkdirSync(outDir, { recursive: true });

  const out = {
    products: [],
    media: [],
    productTags: [],
  };

  walk(rootAbs, [], out);

  const { categories, subcategories } = buildCategoryTree(rootAbs);
  const tags = tagsFromTree(subcategories, out.products);
  const brands = brandsPlaceholder();

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceRoot: rootAbs,
    categories,
    subcategories,
    products: out.products,
    media: out.media,
    tags,
    productTagEdges: out.productTags,
    brands,
  };

  fs.writeFileSync(path.join(outDir, 'catalog.json'), JSON.stringify(payload, null, 2), 'utf8');

  fs.writeFileSync(
    path.join(outDir, 'categories.csv'),
    toCsv(categories, ['id', 'name', 'slug', 'depth', 'parentId', 'path']),
    'utf8'
  );
  fs.writeFileSync(
    path.join(outDir, 'subcategories.csv'),
    toCsv(subcategories, ['id', 'name', 'slug', 'depth', 'parentId', 'path']),
    'utf8'
  );
  fs.writeFileSync(
    path.join(outDir, 'products.csv'),
    toCsv(out.products, ['id', 'name', 'categoryPath', 'folderRelative', 'imageCount', 'primaryImage', 'note']),
    'utf8'
  );
  fs.writeFileSync(
    path.join(outDir, 'media.csv'),
    toCsv(out.media, ['id', 'productId', 'relativePath', 'fileName', 'role']),
    'utf8'
  );
  fs.writeFileSync(
    path.join(outDir, 'tags.csv'),
    toCsv(tags, ['slug', 'label', 'source']),
    'utf8'
  );
  fs.writeFileSync(
    path.join(outDir, 'product_tags.csv'),
    toCsv(out.productTags, ['productId', 'tagSlug']),
    'utf8'
  );
  fs.writeFileSync(
    path.join(outDir, 'brands.csv'),
    toCsv(brands, ['id', 'name', 'slug', 'note']),
    'utf8'
  );

  console.log('Wrote:', outDir);
  console.log('Categories (depth 1):', categories.length);
  console.log('Subcategories (depth 2+):', subcategories.length);
  console.log('Products (leaf image folders):', out.products.length);
  console.log('Media rows:', out.media.length);
  console.log('Tags:', tags.length);
}

main();
