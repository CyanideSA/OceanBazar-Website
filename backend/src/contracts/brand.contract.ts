import { z } from 'zod';

export const BrandSchema = z.object({
  id: z.string(),
  nameEn: z.string(),
  nameBn: z.string(),
  slug: z.string(),
  logoUrl: z.string().nullable().optional(),
  productCount: z.number().int().optional(),
});

export const BrandListResponseSchema = z.object({
  brands: z.array(BrandSchema),
});

export const BrandDetailResponseSchema = z.object({
  brand: BrandSchema.extend({
    products: z.array(z.record(z.unknown())).optional(),
  }),
});
