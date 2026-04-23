/**
 * File-Based Product Import System
 *
 * Folder convention:
 *   All Categories (Demo)/
 *   ├── Electronics/                  ← Category (depth 1)
 *   │   ├── Smartphones/              ← Subcategory (depth 2)
 *   │   │   ├── Samsung Galaxy S24/   ← Product (depth 3)
 *   │   │   │   ├── front.jpg
 *   │   │   │   └── back.jpg
 *
 * API:
 *   POST /api/admin/file-import/scan    → returns tree preview
 *   POST /api/admin/file-import/execute → imports categories + products
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { generateEntityId, generateSlug } from '../../utils/hexId';

const router = Router();
const prisma = new PrismaClient();

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.avi', '.mkv']);

interface ProductNode {
  name: string;
  folderPath: string;
  images: string[];
  videos: string[];
}

interface SubcategoryNode {
  name: string;
  folderPath: string;
  products: ProductNode[];
}

interface CategoryNode {
  name: string;
  folderPath: string;
  subcategories: SubcategoryNode[];
}

function scanTree(rootPath: string): CategoryNode[] {
  if (!fs.existsSync(rootPath)) {
    throw Object.assign(new Error(`Path not found: ${rootPath}`), { status: 400 });
  }

  const categories: CategoryNode[] = [];

  for (const catName of fs.readdirSync(rootPath)) {
    const catPath = path.join(rootPath, catName);
    if (!fs.statSync(catPath).isDirectory()) continue;

    const subcategories: SubcategoryNode[] = [];

    for (const subName of fs.readdirSync(catPath)) {
      const subPath = path.join(catPath, subName);
      if (!fs.statSync(subPath).isDirectory()) continue;

      const products: ProductNode[] = [];

      for (const prodName of fs.readdirSync(subPath)) {
        const prodPath = path.join(subPath, prodName);
        if (!fs.statSync(prodPath).isDirectory()) continue;

        const images: string[] = [];
        const videos: string[] = [];

        for (const file of fs.readdirSync(prodPath)) {
          const ext = path.extname(file).toLowerCase();
          const filePath = path.join(prodPath, file);
          if (!fs.statSync(filePath).isFile()) continue;
          if (IMAGE_EXTS.has(ext)) images.push(file);
          else if (VIDEO_EXTS.has(ext)) videos.push(file);
        }

        products.push({ name: prodName, folderPath: prodPath, images, videos });
      }

      subcategories.push({ name: subName, folderPath: subPath, products });
    }

    categories.push({ name: catName, folderPath: catPath, subcategories });
  }

  return categories;
}

// ─── POST /api/admin/file-import/scan ────────────────────────────────────────

router.post('/scan', async (req: Request, res: Response) => {
  const { rootPath: bodyPath } = req.body as { rootPath?: string };
  const rootPath = bodyPath?.trim() || process.env.ADMIN_STUDIO_ROOT || '';
  if (!rootPath) {
    res.status(400).json({ error: 'rootPath required (or set ADMIN_STUDIO_ROOT)' });
    return;
  }

  try {
    const tree = scanTree(rootPath);
    const stats = {
      categories: tree.length,
      subcategories: tree.reduce((s, c) => s + c.subcategories.length, 0),
      products: tree.reduce((s, c) => s + c.subcategories.reduce((ss, sub) => ss + sub.products.length, 0), 0),
      media: tree.reduce((s, c) => s + c.subcategories.reduce((ss, sub) => ss + sub.products.reduce((sss, p) => sss + p.images.length + p.videos.length, 0), 0), 0),
    };
    res.json({ categories: tree, stats });
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ─── POST /api/admin/file-import/execute ─────────────────────────────────────

router.post('/execute', async (req: Request, res: Response) => {
  const { rootPath: bodyPath, dryRun = false, selectedCategories } = req.body as {
    rootPath?: string;
    dryRun?: boolean;
    selectedCategories?: string[];
  };
  const rootPath = bodyPath?.trim() || process.env.ADMIN_STUDIO_ROOT || '';
  if (!rootPath) {
    res.status(400).json({ error: 'rootPath required (or set ADMIN_STUDIO_ROOT)' });
    return;
  }

  let tree: CategoryNode[];
  try {
    tree = scanTree(rootPath);
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    res.status(err.status || 500).json({ error: err.message });
    return;
  }

  const importedCategories: string[] = [];
  const importedProducts: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  const uploadBase = path.resolve(process.env.UPLOAD_DIR || './uploads', 'products');
  if (!dryRun) fs.mkdirSync(uploadBase, { recursive: true });

  for (const cat of tree) {
    if (selectedCategories?.length && !selectedCategories.includes(cat.name)) continue;

    try {
      // Upsert depth-1 category
      let catRecord = await prisma.category.findFirst({ where: { nameEn: cat.name, parentId: null } });
      if (!catRecord) {
        if (!dryRun) {
          catRecord = await prisma.category.create({
            data: { id: generateEntityId(), nameEn: cat.name, nameBn: cat.name, slug: generateSlug(cat.name) },
          });
          importedCategories.push(cat.name);
        } else {
          importedCategories.push(`[DRY] ${cat.name}`);
        }
      } else {
        skipped.push(`Category already exists: ${cat.name}`);
      }

      for (const sub of cat.subcategories) {
        let subRecord = catRecord
          ? await prisma.category.findFirst({ where: { nameEn: sub.name, parentId: catRecord.id } })
          : null;

        if (!subRecord && catRecord) {
          if (!dryRun) {
            subRecord = await prisma.category.create({
              data: { id: generateEntityId(), nameEn: sub.name, nameBn: sub.name, parentId: catRecord.id, slug: generateSlug(sub.name) },
            });
            importedCategories.push(`  └─ ${sub.name}`);
          } else {
            importedCategories.push(`  └─ [DRY] ${sub.name}`);
          }
        }

        for (const prod of sub.products) {
          // Check if already imported by importSource path
          const existing = await prisma.product.findFirst({ where: { importSource: prod.folderPath } });
          if (existing) {
            skipped.push(`Product already imported: ${prod.name}`);
            continue;
          }

          try {
            if (!dryRun && subRecord) {
              const productId = generateEntityId();
              const productUploadDir = path.join(uploadBase, productId);
              fs.mkdirSync(productUploadDir, { recursive: true });

              // Copy media files
              const productImages: { url: string; assetType: 'image' | 'video'; isPrimary: boolean; sortOrder: number }[] = [];

              let sortOrder = 0;
              for (const imgFile of prod.images) {
                const src = path.join(prod.folderPath, imgFile);
                const dest = path.join(productUploadDir, imgFile);
                fs.copyFileSync(src, dest);
                const publicUrl = `/uploads/products/${productId}/${imgFile}`;
                productImages.push({ url: publicUrl, assetType: 'image', isPrimary: sortOrder === 0, sortOrder: sortOrder });
                sortOrder++;
              }
              for (const vidFile of prod.videos) {
                const src = path.join(prod.folderPath, vidFile);
                const dest = path.join(productUploadDir, vidFile);
                fs.copyFileSync(src, dest);
                const publicUrl = `/uploads/products/${productId}/${vidFile}`;
                productImages.push({ url: publicUrl, assetType: 'video', isPrimary: false, sortOrder: sortOrder });
                sortOrder++;
              }

              await prisma.product.create({
                data: {
                  id: productId,
                  titleEn: prod.name,
                  titleBn: prod.name,
                  categoryId: subRecord.id,
                  status: 'draft',
                  importSource: prod.folderPath,
                  productAssets: { create: productImages },
                  pricing: {
                    create: [
                      { customerType: 'retail', price: 0, tier1MinQty: 2, tier1Discount: 5, tier2MinQty: 6, tier2Discount: 10, tier3MinQty: 11, tier3Discount: 15 },
                    ],
                  },
                },
              });

              importedProducts.push(prod.name);
            } else {
              importedProducts.push(`[DRY] ${prod.name} (${prod.images.length} img, ${prod.videos.length} vid)`);
            }
          } catch (e2) {
            errors.push(`Failed to import product "${prod.name}": ${(e2 as Error).message}`);
          }
        }
      }
    } catch (e3) {
      errors.push(`Failed to process category "${cat.name}": ${(e3 as Error).message}`);
    }
  }

  res.json({
    dryRun,
    imported: { categories: importedCategories, products: importedProducts },
    skipped,
    errors,
    summary: {
      importedCategories: importedCategories.length,
      importedProducts: importedProducts.length,
      skipped: skipped.length,
      errors: errors.length,
    },
  });
});

export default router;
