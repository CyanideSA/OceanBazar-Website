import { z } from 'zod';

export const OrderLineSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.union([z.number(), z.string()]).optional(),
  title: z.string().optional(),
});

export const OrderSchema = z.object({
  id: z.string(),
  orderNumber: z.string().optional(),
  userId: z.string().optional(),
  status: z.string(),
  total: z.union([z.number(), z.string()]).optional(),
  currency: z.string().optional(),
  createdAt: z.string().or(z.date()).optional(),
  items: z.array(OrderLineSchema).optional(),
});

export const PlaceOrderRequestSchema = z.object({
  addressId: z.number().optional(),
  paymentMethod: z.string(),
  couponCode: z.string().optional(),
  notes: z.string().optional(),
});

export const PlaceOrderResponseSchema = z.object({
  order: OrderSchema,
  orderId: z.string().optional(),
  orderNumber: z.string().optional(),
});

export type Order = z.infer<typeof OrderSchema>;
export type PlaceOrderRequest = z.infer<typeof PlaceOrderRequestSchema>;
export type PlaceOrderResponse = z.infer<typeof PlaceOrderResponseSchema>;
