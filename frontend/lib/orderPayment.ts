import { paymentsApi } from '@/lib/api';
import type { PaymentMethod } from '@/types';

export type OnlinePaymentMethod = Exclude<PaymentMethod, 'cod' | 'installment'>;
export type PaymentPurpose = 'order_total' | 'delivery_fee';

export type StartPaymentOptions = {
  purpose?: PaymentPurpose;
  /** Reserved for EasyCheckout callbacks; redirect flow clears cart server-side. */
  onPaid?: () => void;
};

export function canRetryOnlinePayment(method: PaymentMethod | string): method is OnlinePaymentMethod {
  return ['bkash', 'nagad', 'rocket', 'upay', 'sslcommerz'].includes(method);
}

export async function startOrderPayment(
  orderId: string,
  method: PaymentMethod | string,
  options?: StartPaymentOptions,
): Promise<{ redirectUrl?: string; transactionId?: string }> {
  if (!canRetryOnlinePayment(method)) {
    throw new Error('This payment method cannot be retried online.');
  }

  const purpose: PaymentPurpose = options?.purpose === 'delivery_fee' ? 'delivery_fee' : 'order_total';

  try {
    const response =
      method === 'bkash' ? await paymentsApi.bkashInitiate(orderId, purpose)
      : method === 'nagad' ? await paymentsApi.nagadInitiate(orderId, purpose)
      : method === 'rocket' ? await paymentsApi.rocketInitiate(orderId, purpose)
      : method === 'upay' ? await paymentsApi.upayInitiate(orderId, purpose)
      : await paymentsApi.sslcommerz(orderId, purpose);
    const data = response.data as { redirectUrl?: string; transactionId?: string };
    return data;
  } catch (error: any) {
    const message = error?.response?.data?.error;
    throw new Error(message || `Could not start ${method} payment. Please try again.`);
  }
}
