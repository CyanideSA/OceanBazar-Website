import { z } from 'zod';

export const PaymentInitRequestSchema = z.object({
  orderId: z.string(),
  method: z.enum(['bkash', 'nagad', 'sslcommerz', 'cod', 'installment']),
  amount: z.union([z.number(), z.string()]).optional(),
});

export const PaymentInitResponseSchema = z.object({
  transactionId: z.string().optional(),
  redirectUrl: z.string().url().optional(),
  gatewayUrl: z.string().url().optional(),
  status: z.string().optional(),
});

export const PaymentWebhookSchema = z.object({
  orderId: z.string().optional(),
  transactionId: z.string().optional(),
  status: z.string(),
  amount: z.union([z.number(), z.string()]).optional(),
  raw: z.record(z.unknown()).optional(),
});

export type PaymentInitRequest = z.infer<typeof PaymentInitRequestSchema>;
export type PaymentInitResponse = z.infer<typeof PaymentInitResponseSchema>;
export type PaymentWebhook = z.infer<typeof PaymentWebhookSchema>;
