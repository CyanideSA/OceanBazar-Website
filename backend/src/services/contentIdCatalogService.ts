import { type Brand, type Category } from '@prisma/client';
import { invalidateCache } from '../cache/cacheMiddleware';
import { generateEntityId, generateSlug } from '../utils/hexId';
import { prisma } from '../lib/prisma';


export type EnsureResult<T> = { item: T; created: boolean };

function trimName(value: string): string {
  return value.trim();
}

export async function uniqueCategorySlug(baseName: string, parentId?: string | null): Promise<string> {
  const parent = parentId
    ? await prisma.category.findUnique({ where: { id: parentId }, select: { slug: true } })
    : null;
  let candidate = parent ? `${parent.slug}-${generateSlug(baseName)}` : generateSlug(baseName);
  if (!candidate) candidate = 'category';

  let suffix = 1;
  while (true) {
    const existing = await prisma.category.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${parent ? `${parent.slug}-${generateSlug(baseName)}` : generateSlug(baseName)}-${suffix}`;
  }
}

export async function findBrandByName(name: string): Promise<Brand | null> {
  const trimmed = trimName(name);
  const slug = generateSlug(trimmed);
  return prisma.brand.findFirst({
    where: {
      OR: [
        { nameEn: { equals: trimmed, mode: 'insensitive' } },
        { nameBn: { equals: trimmed, mode: 'insensitive' } },
        { slug },
      ],
    },
  });
}

export async function ensureBrand(input: {
  nameEn: string;
  nameBn?: string;
}): Promise<EnsureResult<Brand>> {
  const nameEn = trimName(input.nameEn);
  const existing = await findBrandByName(nameEn);
  if (existing) return { item: existing, created: false };

  const nameBn = trimName(input.nameBn || nameEn);
  let slug = generateSlug(nameEn);
  if (!slug) slug = 'brand';

  let suffix = 1;
  while (await prisma.brand.findUnique({ where: { slug }, select: { id: true } })) {
    suffix += 1;
    slug = `${generateSlug(nameEn)}-${suffix}`;
  }

  const brand = await prisma.brand.create({
    data: {
      id: generateEntityId(),
      nameEn,
      nameBn,
      slug,
      active: true,
    },
  });

  void invalidateCache('bff:brands');
  return { item: brand, created: true };
}

export async function findRootCategory(name: string): Promise<Category | null> {
  const trimmed = trimName(name);
  return prisma.category.findFirst({
    where: {
      parentId: null,
      OR: [
        { nameEn: { equals: trimmed, mode: 'insensitive' } },
        { nameBn: { equals: trimmed, mode: 'insensitive' } },
      ],
    },
  });
}

export async function findSubcategory(parentId: string, name: string): Promise<Category | null> {
  const trimmed = trimName(name);
  return prisma.category.findFirst({
    where: {
      parentId,
      OR: [
        { nameEn: { equals: trimmed, mode: 'insensitive' } },
        { nameBn: { equals: trimmed, mode: 'insensitive' } },
      ],
    },
  });
}

export async function ensureRootCategory(input: {
  nameEn: string;
  nameBn?: string;
}): Promise<EnsureResult<Category>> {
  const nameEn = trimName(input.nameEn);
  const existing = await findRootCategory(nameEn);
  if (existing) return { item: existing, created: false };

  const nameBn = trimName(input.nameBn || nameEn);
  const slug = await uniqueCategorySlug(nameEn, null);

  const category = await prisma.category.create({
    data: {
      id: generateEntityId(),
      nameEn,
      nameBn,
      slug,
      parentId: null,
      depth: 0,
      path: slug,
      is_leaf: false,
      sortOrder: 0,
    },
  });

  void invalidateCache('bff:categories');
  return { item: category, created: true };
}

export async function ensureSubcategory(input: {
  parentId: string;
  nameEn: string;
  nameBn?: string;
}): Promise<EnsureResult<Category>> {
  const parent = await prisma.category.findUnique({ where: { id: input.parentId } });
  if (!parent) throw new Error('parent_not_found');
  if (parent.parentId !== null) throw new Error('parent_must_be_root');

  const nameEn = trimName(input.nameEn);
  const existing = await findSubcategory(parent.id, nameEn);
  if (existing) return { item: existing, created: false };

  const nameBn = trimName(input.nameBn || nameEn);
  const slug = await uniqueCategorySlug(nameEn, parent.id);
  const path = parent.path ? `${parent.path}/${slug}` : slug;

  const [subcategory] = await prisma.$transaction([
    prisma.category.create({
      data: {
        id: generateEntityId(),
        nameEn,
        nameBn,
        slug,
        parentId: parent.id,
        depth: 1,
        path,
        is_leaf: true,
        sortOrder: 0,
      },
    }),
    prisma.category.update({
      where: { id: parent.id },
      data: { is_leaf: false },
    }),
  ]);

  void invalidateCache('bff:categories');
  return { item: subcategory, created: true };
}

export async function fetchCatalogTree() {
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({
      where: { parentId: null },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        nameEn: true,
        nameBn: true,
        children: {
          orderBy: { sortOrder: 'asc' },
          select: { id: true, nameEn: true, nameBn: true },
        },
      },
    }),
    prisma.brand.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
      select: { id: true, nameEn: true, nameBn: true },
    }),
  ]);

  return {
    categories: categories.map((c) => ({
      id: c.id,
      nameEn: c.nameEn,
      nameBn: c.nameBn,
      subcategories: c.children.map((s) => ({
        id: s.id,
        nameEn: s.nameEn,
        nameBn: s.nameBn,
      })),
    })),
    brands: brands.map((b) => ({
      id: b.id,
      nameEn: b.nameEn,
      nameBn: b.nameBn,
    })),
  };
}

export async function resolveCatalogSelection(input: {
  categoryId?: string;
  subcategoryId?: string;
  brandId?: string;
  categoryName?: string;
  subcategoryName?: string;
  brandName?: string;
}): Promise<{
  categoryId: string | null;
  subcategoryId: string | null;
  brandId: string | null;
  categoryName: string;
  subcategoryName: string;
  brandName: string;
} | { error: string }> {
  if (input.categoryId && input.subcategoryId && input.brandId) {
    const [root, leaf, brand] = await Promise.all([
      prisma.category.findUnique({ where: { id: input.categoryId } }),
      prisma.category.findUnique({ where: { id: input.subcategoryId } }),
      prisma.brand.findUnique({ where: { id: input.brandId } }),
    ]);
    if (!brand) return { error: 'invalid_brand_id' };
    if (!root || root.parentId !== null) return { error: 'invalid_category_id' };
    if (!leaf || leaf.parentId !== root.id) return { error: 'subcategory_parent_mismatch' };

    return {
      categoryId: root.id,
      subcategoryId: leaf.id,
      brandId: brand.id,
      categoryName: root.nameEn,
      subcategoryName: leaf.nameEn,
      brandName: brand.nameEn,
    };
  }

  if (input.categoryName && input.subcategoryName && input.brandName) {
    const brand = await findBrandByName(input.brandName);
    const root = await findRootCategory(input.categoryName);
    const leaf = root ? await findSubcategory(root.id, input.subcategoryName) : null;

    return {
      categoryId: root?.id ?? null,
      subcategoryId: leaf?.id ?? null,
      brandId: brand?.id ?? null,
      categoryName: trimName(input.categoryName),
      subcategoryName: trimName(input.subcategoryName),
      brandName: trimName(input.brandName),
    };
  }

  return { error: 'catalog_selection_required' };
}
