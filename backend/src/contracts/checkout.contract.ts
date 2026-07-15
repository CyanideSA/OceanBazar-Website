import { z } from 'zod';

export const CheckoutLineResultSchema = z.object({
  productId: z.string(),
  variantId: z.string().nullable().optional(),
  productTitle: z.string(),
  quantity: z.number().int(),
  unitPrice: z.union([z.number(), z.string()]),
  lineTotal: z.union([z.number(), z.string()]),
  discountPct: z.union([z.number(), z.string()]).optional(),
  tierApplied: z.number().int().optional(),
});

export const CheckoutTotalsSchema = z.object({
  subtotal: z.union([z.number(), z.string()]),
  discount: z.union([z.number(), z.string()]),
  gst: z.union([z.number(), z.string()]),
  shippingFee: z.union([z.number(), z.string()]),
  serviceFee: z.union([z.number(), z.string()]),
  obDiscount: z.union([z.number(), z.string()]),
  total: z.union([z.number(), z.string()]),
});

export const CheckoutValidateResponseSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  lines: z.array(CheckoutLineResultSchema),
  totals: CheckoutTotalsSchema.optional(),
  couponDiscount: z.union([z.number(), z.string()]).optional(),
  freeShipping: z.boolean().optional(),
  obDiscount: z.union([z.number(), z.string()]).optional(),
  obPointsEarned: z.number().int().optional(),
  codAllowed: z.boolean().optional(),
});

export type CheckoutValidateResponse = z.infer<typeof CheckoutValidateResponseSchema>;
