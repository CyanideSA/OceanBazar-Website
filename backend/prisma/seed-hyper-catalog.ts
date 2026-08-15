import { PrismaClient, Prisma } from '@prisma/client';
import { generateEntityId } from '../src/utils/hexId';

const prisma = new PrismaClient();

const TOP_CATEGORIES = [
  'electronics',
  'beauty',
  'fashion',
  'home-living',
  'groceries',
  'health',
  'baby-kids',
  'sports-outdoors',
  'automotive',
  'office-school',
];

const SUBCATEGORY_BASE = [
  'premium',
  'budget',
  'new-arrivals',
  'best-sellers',
  'essentials',
  'pro-series',
  'daily-use',
  'gift-picks',
  'seasonal',
  'smart-choice',
];

const BRANDS = [
  'oceanmax',
  'nexa',
  'primewave',
  'zenith',
  'orion',
  'aether',
  'nova',
  'vertex',
  'lumina',
  'elevate',
];

function toTitle(slug: string) {
  return slug
    .split('-')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

async function ensureCategory(slug: string, parentId: string | null, depth: number, sortOrder: number) {
  const nameEn = toTitle(slug);
  const nameBn = `${nameEn} ক্যাটাগরি`;
  const path = parentId ? `/${slug}` : slug;
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) {
    return prisma.category.update({
      where: { id: existing.id },
      data: { nameEn, nameBn, parentId, depth, path, sortOrder, is_leaf: depth > 0 },
    });
  }
  return prisma.category.create({
    data: {
      id: generateEntityId(),
      slug,
      nameEn,
      nameBn,
      parentId,
      depth,
      path,
      sortOrder,
      is_leaf: depth > 0,
    },
  });
}

async function ensureBrand(slug: string, index: number) {
  const nameEn = toTitle(slug);
  const nameBn = `${nameEn} ব্র্যান্ড`;
  const logoUrl = `https://res.cloudinary.com/dmtafp1fi/image/upload/v1710000000/oceanbazar/brands/${slug}.png`;
  const existing = await prisma.brand.findUnique({ where: { slug } });
  if (existing) {
    return prisma.brand.update({
      where: { id: existing.id },
      data: { nameEn, nameBn, logoUrl, sortOrder: index, active: true },
    });
  }
  return prisma.brand.create({
    data: {
      id: generateEntityId(),
      slug,
      nameEn,
      nameBn,
      logoUrl,
      sortOrder: index,
      active: true,
    },
  });
}

function makeSku(categoryIdx: number, subIdx: number, brandIdx: number, productIdx: number) {
  return `OB-${String(categoryIdx + 1).padStart(2, '0')}${String(subIdx + 1).padStart(2, '0')}${String(brandIdx + 1).padStart(2, '0')}${String(productIdx + 1).padStart(3, '0')}`;
}

async function upsertProduct(
  categoryId: string,
  categorySlug: string,
  subSlug: string,
  brandId: string,
  brandSlug: string,
  indices: { c: number; s: number; b: number; p: number }
) {
  const sku = makeSku(indices.c, indices.s, indices.b, indices.p);
  const nameCore = `${toTitle(brandSlug)} ${toTitle(subSlug)} ${indices.p + 1}`;
  const retail = 800 + indices.c * 300 + indices.s * 75 + indices.b * 55 + indices.p * 10;
  const wholesale = Math.round(retail * 0.86);
  const mediaBase = `https://res.cloudinary.com/dmtafp1fi/image/upload/v1710000000/oceanbazar/hyper/${categorySlug}/${subSlug}/${brandSlug}-${indices.p + 1}`;
  const specs: Prisma.InputJsonValue = {
    model: `${brandSlug}-${subSlug}-${indices.p + 1}`,
    warranty: '1 Year OceanBazar Warranty',
    origin: 'Imported',
    material: 'Premium Grade',
    color: ['Black', 'Silver', 'Blue', 'Red'][indices.p % 4],
  };

  const existing = await prisma.product.findFirst({ where: { sku } });
  if (!existing) {
    const created = await prisma.product.create({
      data: {
        id: generateEntityId(),
        titleEn: nameCore,
        titleBn: `${nameCore} অফিসিয়াল`,
        descriptionEn: `${nameCore} with complete specifications, quality media, and optimized pricing for both retail and wholesale.`,
        descriptionBn: `${nameCore} সম্পূর্ণ স্পেসিফিকেশন, কোয়ালিটি মিডিয়া এবং রিটেইল/হোলসেল প্রাইসিং সহ।`,
        sku,
        stock: 100 + (indices.p % 20) * 5,
        moq: 2,
        status: 'active',
        brand: toTitle(brandSlug),
        brandId,
        specifications: specs,
        pricingMode: 'tiered',
      },
    });

    await prisma.productCategoryMap.create({
      data: {
        productId: created.id,
        categoryId,
        isPrimary: true,
        sortOrder: 0,
      },
    });

    await prisma.productPricing.createMany({
      data: [
        {
          productId: created.id,
          customerType: 'retail',
          price: retail,
          compareAt: Math.round(retail * 1.12),
          tier1MinQty: 2,
          tier1Discount: 4,
          tier2MinQty: 5,
          tier2Discount: 8,
          tier3MinQty: 10,
          tier3Discount: 12,
        },
        {
          productId: created.id,
          customerType: 'wholesale',
          price: wholesale,
          tier1MinQty: 10,
          tier1Discount: 3,
          tier2MinQty: 20,
          tier2Discount: 6,
          tier3MinQty: 40,
          tier3Discount: 10,
        },
      ],
    });

    await prisma.productAttribute.createMany({
      data: [
        { productId: created.id, attrKey: 'size', attrValue: ['S', 'M', 'L', 'XL'][indices.p % 4], sortOrder: 0 },
        { productId: created.id, attrKey: 'variant', attrValue: ['Standard', 'Plus', 'Pro'][indices.p % 3], sortOrder: 1 },
        { productId: created.id, attrKey: 'pack', attrValue: `${(indices.p % 5) + 1} pcs`, sortOrder: 2 },
      ],
    });

    await prisma.productAsset.createMany({
      data: [
        {
          productId: created.id,
          assetType: 'image',
          url: `${mediaBase}-1.jpg`,
          altEn: `${nameCore} image 1`,
          altBn: `${nameCore} ছবি ১`,
          sortOrder: 0,
          isPrimary: true,
          mimeType: 'image/jpeg',
        },
        {
          productId: created.id,
          assetType: 'image',
          url: `${mediaBase}-2.jpg`,
          altEn: `${nameCore} image 2`,
          altBn: `${nameCore} ছবি ২`,
          sortOrder: 1,
          isPrimary: false,
          mimeType: 'image/jpeg',
        },
        {
          productId: created.id,
          assetType: 'video',
          url: mediaBase.replace('/image/upload/', '/video/upload/') + '-demo.mp4',
          altEn: `${nameCore} demo`,
          altBn: `${nameCore} ডেমো`,
          sortOrder: 2,
          isPrimary: false,
          mimeType: 'video/mp4',
        },
      ],
    });
    return;
  }
}

async function main() {
  console.log('Seeding hyper catalog...');
  const brandMap = new Map<string, string>();
  for (let i = 0; i < BRANDS.length; i++) {
    const b = await ensureBrand(BRANDS[i], i);
    brandMap.set(BRANDS[i], b.id);
  }

  let generated = 0;
  for (let c = 0; c < TOP_CATEGORIES.length; c++) {
    const topSlug = TOP_CATEGORIES[c];
    const top = await ensureCategory(topSlug, null, 0, c);

    for (let s = 0; s < SUBCATEGORY_BASE.length; s++) {
      const subSlug = `${topSlug}-${SUBCATEGORY_BASE[s]}`;
      const sub = await ensureCategory(subSlug, top.id, 1, s);
      await prisma.category.update({ where: { id: top.id }, data: { is_leaf: false } });

      for (let b = 0; b < BRANDS.length; b++) {
        const brandSlug = BRANDS[b];
        const brandId = brandMap.get(brandSlug)!;
        for (let p = 0; p < 10; p++) {
          await upsertProduct(sub.id, topSlug, subSlug, brandId, brandSlug, { c, s, b, p });
          generated++;
          if (generated % 500 === 0) console.log(`Generated ${generated} products...`);
        }
      }
    }
  }

  const [products, categories, brands, assets] = await Promise.all([
    prisma.product.count(),
    prisma.category.count(),
    prisma.brand.count(),
    prisma.productAsset.count(),
  ]);
  console.log(JSON.stringify({ products, categories, brands, productAssets: assets }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
