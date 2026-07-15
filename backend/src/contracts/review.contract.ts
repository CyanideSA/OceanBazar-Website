import { z } from 'zod';

export const ReviewSchema = z.object({
  id: z.union([z.string(), z.number()]),
  productId: z.string(),
  userId: z.string().optional(),
  rating: z.number().optional(),
  comment: z.string().optional(),
  status: z.string().optional(),
  createdAt: z.string().optional(),
});

export const StorefrontReviewSchema = z.object({
  id: z.string(),
  rating: z.number(),
  title: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  imageUrls: z.array(z.string()).optional(),
  helpfulCount: z.number().optional(),
  unhelpfulCount: z.number().optional(),
  verifiedPurchase: z.boolean().optional(),
  authorName: z.string().optional(),
  createdAt: z.string(),
});

export const ReviewListResponseSchema = z.object({
  reviews: z.array(StorefrontReviewSchema).optional(),
  items: z.array(ReviewSchema).optional(),
  ratingDistribution: z.record(z.number()).optional(),
  pagination: z
    .object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      pages: z.number(),
    })
    .optional(),
  total: z.number().optional(),
});
