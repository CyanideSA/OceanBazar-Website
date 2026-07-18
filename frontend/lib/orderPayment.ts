import { paymentsApi } from '@/lib/api';
import type { PaymentMethod } from '@/types';

export type OnlinePaymentMethod = Exclude<PaymentMethod, 'cod' | 'installment'>;

export function canRetryOnlinePayment(method: PaymentMethod | string): method is OnlinePaymentMethod {
  return ['bkash', 'nagad', 'rocket', 'upay', 'sslcommerz'].includes(method);
}

export async function startOrderPayment(
  orderId: string,
  method: PaymentMethod | string,
): Promise<{ redirectUrl?: string; transactionId?: string }> {
  if (!canRetryOnlinePayment(method)) {
    throw new Error('This payment method cannot be retried online.');
  }

  try {
    const response =
      method === 'bkash' ? await paymentsApi.bkashInitiate(orderId)
      : method === 'nagad' ? await paymentsApi.nagadInitiate(orderId)
      : method === 'rocket' ? await paymentsApi.rocketInitiate(orderId)
      : method === 'upay' ? await paymentsApi.upayInitiate(orderId)
      : await paymentsApi.sslcommerz(orderId);
    const data = response.data as { redirectUrl?: string; transactionId?: string };
    return data;
  } catch (error: any) {
    const message = error?.response?.data?.error;
    throw new Error(message || `Could not start ${method} payment. Please try again.`);
  }
}
