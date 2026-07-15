import { z } from 'zod';

export const CategoryTreeNodeSchema: z.ZodType<{
  id: string;
  nameEn?: string;
  nameBn?: string;
  slug?: string;
  parentId?: string | null;
  icon?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
  children?: unknown[];
}> = z.lazy(() =>
  z.object({
    id: z.string(),
    nameEn: z.string().optional(),
    nameBn: z.string().optional(),
    slug: z.string().optional(),
    parentId: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    sortOrder: z.number().optional(),
    children: z.array(CategoryTreeNodeSchema).optional(),
  }),
);

export const CategorySchema = CategoryTreeNodeSchema;

export const CategoryListResponseSchema = z.object({
  categories: z.array(CategoryTreeNodeSchema).optional(),
  items: z.array(CategoryTreeNodeSchema).optional(),
  data: z.array(CategoryTreeNodeSchema).optional(),
});
