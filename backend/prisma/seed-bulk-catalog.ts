import { PrismaClient, Prisma } from '@prisma/client';
import { generateEntityId } from '../src/utils/hexId';

const prisma = new PrismaClient();

type CategorySeed = {
  nameEn: string;
  nameBn: string;
  slug: string;
  icon?: string;
  parentSlug?: string;
  sortOrder: number;
};

type BrandSeed = {
  nameEn: string;
  nameBn: string;
  slug: string;
  logoUrl: string;
  sortOrder: number;
};

type ProductSeed = {
  titleEn: string;
  titleBn: string;
  descriptionEn: string;
  descriptionBn: string;
  sku: string;
  stock: number;
  moq: number;
  categorySlug: string;
  brandSlug: string;
  retailPrice: number;
  retailCompareAt?: number;
  wholesalePrice: number;
  specifications: Record<string, string>;
  attributes: Array<{ key: string; value: string }>;
  mediaBase: string;
};

function toTitleCase(input: string) {
  return input
    .replace(/[-_]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

async function upsertCategory(
  item: CategorySeed,
  parentId: string | null,
  depth: number,
  path: string
) {
  const existing = await prisma.category.findUnique({ where: { slug: item.slug } });
  if (existing) {
    return prisma.category.update({
      where: { id: existing.id },
      data: {
        nameEn: item.nameEn,
        nameBn: item.nameBn,
        icon: item.icon,
        parentId,
        depth,
        path,
        is_leaf: true,
        sortOrder: item.sortOrder,
      },
    });
  }
  return prisma.category.create({
    data: {
      id: generateEntityId(),
      nameEn: item.nameEn,
      nameBn: item.nameBn,
      slug: item.slug,
      icon: item.icon,
      parentId,
      depth,
      path,
      is_leaf: true,
      sortOrder: item.sortOrder,
    },
  });
}

async function upsertBrand(item: BrandSeed) {
  const existing = await prisma.brand.findUnique({ where: { slug: item.slug } });
  if (existing) {
    return prisma.brand.update({
      where: { id: existing.id },
      data: {
        nameEn: item.nameEn,
        nameBn: item.nameBn,
        logoUrl: item.logoUrl,
        sortOrder: item.sortOrder,
        active: true,
      },
    });
  }
  return prisma.brand.create({
    data: {
      id: generateEntityId(),
      nameEn: item.nameEn,
      nameBn: item.nameBn,
      slug: item.slug,
      logoUrl: item.logoUrl,
      sortOrder: item.sortOrder,
      active: true,
    },
  });
}

async function upsertProduct(item: ProductSeed, brandId: string, categoryId: string) {
  const existing = await prisma.product.findFirst({ where: { sku: item.sku } });
  const specificationsJson: Prisma.InputJsonValue = item.specifications;

  if (!existing) {
    return prisma.product.create({
      data: {
        id: generateEntityId(),
        titleEn: item.titleEn,
        titleBn: item.titleBn,
        descriptionEn: item.descriptionEn,
        descriptionBn: item.descriptionBn,
        sku: item.sku,
        stock: item.stock,
        moq: item.moq,
        status: 'active',
        brand: toTitleCase(item.brandSlug),
        brandId,
        specifications: specificationsJson,
        productCategories: {
          create: [{ categoryId, isPrimary: true, sortOrder: 0 }],
        },
        pricing: {
          create: [
            {
              customerType: 'retail',
              price: item.retailPrice,
              compareAt: item.retailCompareAt,
              tier1MinQty: 2,
              tier1Discount: 5,
              tier2MinQty: 6,
              tier2Discount: 10,
              tier3MinQty: 11,
              tier3Discount: 15,
            },
            {
              customerType: 'wholesale',
              price: item.wholesalePrice,
              tier1MinQty: 5,
              tier1Discount: 2,
              tier2MinQty: 15,
              tier2Discount: 5,
              tier3MinQty: 30,
              tier3Discount: 8,
            },
          ],
        },
      },
    });
  }

  await prisma.product.update({
    where: { id: existing.id },
    data: {
      titleEn: item.titleEn,
      titleBn: item.titleBn,
      descriptionEn: item.descriptionEn,
      descriptionBn: item.descriptionBn,
      stock: item.stock,
      moq: item.moq,
      status: 'active',
      brand: toTitleCase(item.brandSlug),
      brandId,
      specifications: specificationsJson,
    },
  });

  await prisma.productCategoryMap.upsert({
    where: { productId_categoryId: { productId: existing.id, categoryId } },
    update: { isPrimary: true, sortOrder: 0 },
    create: { productId: existing.id, categoryId, isPrimary: true, sortOrder: 0 },
  });

  return existing;
}

function makeProducts(): ProductSeed[] {
  const rows: Array<{ family: string; brand: string; category: string; base: number }> = [
    { family: 'Galaxy A26', brand: 'samsung', category: 'smartphones', base: 31990 },
    { family: 'Redmi Note 13', brand: 'xiaomi', category: 'smartphones', base: 27990 },
    { family: 'iPhone 14', brand: 'apple', category: 'smartphones', base: 102900 },
    { family: 'Pova 6 Pro', brand: 'tecno', category: 'smartphones', base: 31900 },
    { family: 'ThinkPad E14', brand: 'lenovo', category: 'laptops', base: 85800 },
    { family: 'Yoga Slim 7', brand: 'lenovo', category: 'laptops', base: 114500 },
    { family: 'MacBook Air M2', brand: 'apple', category: 'laptops', base: 149900 },
    { family: 'Galaxy Book 3', brand: 'samsung', category: 'laptops', base: 123500 },
    { family: 'WH-CH520', brand: 'sony', category: 'audio', base: 5900 },
    { family: 'JBL Tune 760NC', brand: 'jbl', category: 'audio', base: 8600 },
    { family: 'AirPods 3', brand: 'apple', category: 'audio', base: 25400 },
    { family: 'Samsung Buds FE', brand: 'samsung', category: 'audio', base: 10900 },
    { family: 'Mi Smart TV 43', brand: 'xiaomi', category: 'television', base: 37990 },
    { family: 'Bravia X75L 50', brand: 'sony', category: 'television', base: 82900 },
    { family: 'Crystal UHD 55', brand: 'samsung', category: 'television', base: 71500 },
    { family: 'Apple TV 4K', brand: 'apple', category: 'television', base: 23900 },
    { family: 'Power Bank 20000', brand: 'anker', category: 'accessories', base: 4990 },
    { family: 'GaN Charger 65W', brand: 'anker', category: 'accessories', base: 3390 },
    { family: 'USB-C Hub 8-in-1', brand: 'ugreen', category: 'accessories', base: 4290 },
    { family: 'Keyboard K380', brand: 'logitech', category: 'accessories', base: 3890 },
    { family: 'MX Master 3S', brand: 'logitech', category: 'accessories', base: 11200 },
    { family: 'Monitor 24 IPS', brand: 'dell', category: 'accessories', base: 19400 },
    { family: 'SSD NVMe 1TB', brand: 'samsung', category: 'accessories', base: 9900 },
    { family: 'Router AX3000', brand: 'tp-link', category: 'accessories', base: 7400 },
  ];

  return rows.map((row, i) => {
    const n = i + 1;
    const titleEn = `${toTitleCase(row.brand)} ${row.family}`;
    const titleBn = `${titleEn} অফিসিয়াল`;
    const slugBase = `${row.brand}-${row.family.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`.replace(/-+/g, '-');
    return {
      titleEn,
      titleBn,
      descriptionEn: `${titleEn} with reliable official warranty, rich feature set, and strong performance for Bangladesh buyers.`,
      descriptionBn: `${titleEn} অফিসিয়াল ওয়ারেন্টি, ভালো পারফরম্যান্স এবং দৈনন্দিন ব্যবহারের জন্য নির্ভরযোগ্য পণ্য।`,
      sku: `OB-${row.brand.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 3)}-${String(n).padStart(3, '0')}`,
      stock: 40 + (i % 11) * 7,
      moq: row.base > 50000 ? 1 : 2,
      categorySlug: row.category,
      brandSlug: row.brand,
      retailPrice: row.base,
      retailCompareAt: Math.round(row.base * 1.08),
      wholesalePrice: Math.round(row.base * 0.9),
      specifications: {
        model: row.family,
        brand: toTitleCase(row.brand),
        warranty: '1 Year Official Warranty',
        origin: 'Global',
        connectivity: 'Wi-Fi, Bluetooth',
        sellerWarranty: 'Service support from OceanBazar',
      },
      attributes: [
        { key: 'color', value: ['Black', 'Blue', 'Silver'][i % 3] },
        { key: 'storage', value: ['128GB', '256GB', '512GB'][i % 3] },
        { key: 'ram', value: ['8GB', '12GB', '16GB'][i % 3] },
      ],
      mediaBase: `https://res.cloudinary.com/dmtafp1fi/image/upload/v1710000000/oceanbazar/demo/${slugBase}`,
    };
  });
}

async function main() {
  console.log('Seeding bulk catalog...');
  const categories: CategorySeed[] = [
    { nameEn: 'Electronics', nameBn: 'ইলেকট্রনিক্স', slug: 'electronics', icon: '📱', sortOrder: 0 },
    { nameEn: 'Smartphones', nameBn: 'স্মার্টফোন', slug: 'smartphones', parentSlug: 'electronics', sortOrder: 0 },
    { nameEn: 'Laptops', nameBn: 'ল্যাপটপ', slug: 'laptops', parentSlug: 'electronics', sortOrder: 1 },
    { nameEn: 'Audio', nameBn: 'অডিও', slug: 'audio', parentSlug: 'electronics', sortOrder: 2 },
    { nameEn: 'Television', nameBn: 'টেলিভিশন', slug: 'television', parentSlug: 'electronics', sortOrder: 3 },
    { nameEn: 'Accessories', nameBn: 'এক্সেসরিজ', slug: 'accessories', parentSlug: 'electronics', sortOrder: 4 },
  ];

  const brands: BrandSeed[] = [
    { nameEn: 'Samsung', nameBn: 'স্যামসাং', slug: 'samsung', logoUrl: 'https://res.cloudinary.com/dmtafp1fi/image/upload/v1710000000/oceanbazar/brands/samsung.png', sortOrder: 0 },
    { nameEn: 'Apple', nameBn: 'অ্যাপল', slug: 'apple', logoUrl: 'https://res.cloudinary.com/dmtafp1fi/image/upload/v1710000000/oceanbazar/brands/apple.png', sortOrder: 1 },
    { nameEn: 'Xiaomi', nameBn: 'শাওমি', slug: 'xiaomi', logoUrl: 'https://res.cloudinary.com/dmtafp1fi/image/upload/v1710000000/oceanbazar/brands/xiaomi.png', sortOrder: 2 },
    { nameEn: 'Sony', nameBn: 'সনি', slug: 'sony', logoUrl: 'https://res.cloudinary.com/dmtafp1fi/image/upload/v1710000000/oceanbazar/brands/sony.png', sortOrder: 3 },
    { nameEn: 'Lenovo', nameBn: 'লেনোভো', slug: 'lenovo', logoUrl: 'https://res.cloudinary.com/dmtafp1fi/image/upload/v1710000000/oceanbazar/brands/lenovo.png', sortOrder: 4 },
    { nameEn: 'JBL', nameBn: 'জেবিএল', slug: 'jbl', logoUrl: 'https://res.cloudinary.com/dmtafp1fi/image/upload/v1710000000/oceanbazar/brands/jbl.png', sortOrder: 5 },
    { nameEn: 'Anker', nameBn: 'অ্যাঙ্কার', slug: 'anker', logoUrl: 'https://res.cloudinary.com/dmtafp1fi/image/upload/v1710000000/oceanbazar/brands/anker.png', sortOrder: 6 },
    { nameEn: 'Ugreen', nameBn: 'ইউগ্রিন', slug: 'ugreen', logoUrl: 'https://res.cloudinary.com/dmtafp1fi/image/upload/v1710000000/oceanbazar/brands/ugreen.png', sortOrder: 7 },
    { nameEn: 'Logitech', nameBn: 'লজিটেক', slug: 'logitech', logoUrl: 'https://res.cloudinary.com/dmtafp1fi/image/upload/v1710000000/oceanbazar/brands/logitech.png', sortOrder: 8 },
    { nameEn: 'Dell', nameBn: 'ডেল', slug: 'dell', logoUrl: 'https://res.cloudinary.com/dmtafp1fi/image/upload/v1710000000/oceanbazar/brands/dell.png', sortOrder: 9 },
    { nameEn: 'TP-Link', nameBn: 'টি পি লিংক', slug: 'tp-link', logoUrl: 'https://res.cloudinary.com/dmtafp1fi/image/upload/v1710000000/oceanbazar/brands/tplink.png', sortOrder: 10 },
    { nameEn: 'Tecno', nameBn: 'টেকনো', slug: 'tecno', logoUrl: 'https://res.cloudinary.com/dmtafp1fi/image/upload/v1710000000/oceanbazar/brands/tecno.png', sortOrder: 11 },
  ];

  const categoriesBySlug = new Map<string, string>();
  for (const category of categories.filter((c) => !c.parentSlug)) {
    const created = await upsertCategory(category, null, 0, category.slug);
    categoriesBySlug.set(category.slug, created.id);
  }
  for (const category of categories.filter((c) => c.parentSlug)) {
    const parentId = categoriesBySlug.get(category.parentSlug!);
    if (!parentId) continue;
    const created = await upsertCategory(category, parentId, 1, `${category.parentSlug}/${category.slug}`);
    categoriesBySlug.set(category.slug, created.id);
    await prisma.category.update({ where: { id: parentId }, data: { is_leaf: false } });
  }

  const brandsBySlug = new Map<string, string>();
  for (const brand of brands) {
    const created = await upsertBrand(brand);
    brandsBySlug.set(brand.slug, created.id);
  }

  const products = makeProducts();
  for (const product of products) {
    const brandId = brandsBySlug.get(product.brandSlug);
    const categoryId = categoriesBySlug.get(product.categorySlug);
    if (!brandId || !categoryId) continue;

    const upserted = await upsertProduct(product, brandId, categoryId);
    const productId = upserted.id;

    await prisma.productAsset.deleteMany({ where: { productId } });
    await prisma.productAttribute.deleteMany({ where: { productId } });

    await prisma.productAttribute.createMany({
      data: product.attributes.map((attr, index) => ({
        productId,
        attrKey: attr.key,
        attrValue: attr.value,
        sortOrder: index,
      })),
    });

    await prisma.productAsset.createMany({
      data: [
        {
          productId,
          assetType: 'image',
          url: `${product.mediaBase}-front.jpg`,
          altEn: `${product.titleEn} front`,
          altBn: `${product.titleBn} সামনে`,
          sortOrder: 0,
          isPrimary: true,
          mimeType: 'image/jpeg',
        },
        {
          productId,
          assetType: 'image',
          url: `${product.mediaBase}-back.jpg`,
          altEn: `${product.titleEn} back`,
          altBn: `${product.titleBn} পিছনে`,
          sortOrder: 1,
          isPrimary: false,
          mimeType: 'image/jpeg',
        },
        {
          productId,
          assetType: 'video',
          url: product.mediaBase.replace('/image/upload/', '/video/upload/') + '-demo.mp4',
          altEn: `${product.titleEn} demo video`,
          altBn: `${product.titleBn} ডেমো ভিডিও`,
          sortOrder: 2,
          isPrimary: false,
          mimeType: 'video/mp4',
        },
      ],
    });
  }

  const [countProducts, countCategories, countBrands, countAssets] = await Promise.all([
    prisma.product.count(),
    prisma.category.count(),
    prisma.brand.count(),
    prisma.productAsset.count(),
  ]);
  console.log(
    JSON.stringify(
      {
        products: countProducts,
        categories: countCategories,
        brands: countBrands,
        productAssets: countAssets,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
