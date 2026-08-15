import { z } from 'zod';

export const ProductSummarySchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  name: z.string().optional(),
  slug: z.string().optional(),
  price: z.union([z.number(), z.string()]).optional(),
  image: z.string().optional(),
  thumbnail: z.string().optional(),
  inStock: z.boolean().optional(),
  status: z.string().optional(),
});

export const ProductListResponseSchema = z.object({
  items: z.array(ProductSummarySchema).optional(),
  products: z.array(ProductSummarySchema).optional(),
  data: z.array(ProductSummarySchema).optional(),
  total: z.number().optional(),
  page: z.number().optional(),
  pageSize: z.number().optional(),
});

export const CatalogChangeEventSchema = z.object({
  productId: z.string(),
  change: z.enum(['created', 'updated', 'deleted', 'moved']).default('updated'),
});

export type ProductSummary = z.infer<typeof ProductSummarySchema>;
export type ProductListResponse = z.infer<typeof ProductListResponseSchema>;
export type CatalogChangeEvent = z.infer<typeof CatalogChangeEventSchema>;
