import { paymentsApi } from '@/lib/api';
import type { PaymentMethod } from '@/types';
import { startSslCheckoutFromInitiate, type SslInitiateResult } from '@/lib/sslcommerzEasyCheckout';

export type OnlinePaymentMethod = Exclude<PaymentMethod, 'cod' | 'installment'>;

export function canRetryOnlinePayment(method: PaymentMethod | string): method is OnlinePaymentMethod {
  return ['bkash', 'nagad', 'rocket', 'upay', 'sslcommerz'].includes(method);
}

export async function startOrderPayment(
  orderId: string,
  method: PaymentMethod | string,
  opts?: { purpose?: 'order_total' | 'delivery_fee'; onPaid?: () => void },
): Promise<{ redirectUrl?: string; transactionId?: string; data?: string | null; logo?: string | null; status?: string }> {
  const sslMethod = method === 'cod' ? 'sslcommerz' : method;
  if (method !== 'cod' && !canRetryOnlinePayment(method)) {
    throw new Error('This payment method cannot be retried online.');
  }

  try {
    const response =
      sslMethod === 'bkash' ? await paymentsApi.bkashInitiate(orderId)
      : sslMethod === 'nagad' ? await paymentsApi.nagadInitiate(orderId)
      : sslMethod === 'rocket' ? await paymentsApi.rocketInitiate(orderId)
      : sslMethod === 'upay' ? await paymentsApi.upayInitiate(orderId)
      : await paymentsApi.sslcommerz(orderId, { purpose: opts?.purpose });
    const data = response.data as SslInitiateResult & { redirectUrl?: string; transactionId?: string; purpose?: string };

    // #region agent log
    fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'ssl-init-fe',hypothesisId:'H-C',location:'orderPayment.ts:start',message:'frontend payment initiate',data:{orderId,method:sslMethod,purpose:opts?.purpose||data?.purpose||null,amount:(data as any)?.amount??null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    // SSLCommerz (and rocket/upay via SSL, or COD delivery-fee prepay): compact Easy Checkout
    if (sslMethod === 'sslcommerz' || sslMethod === 'rocket' || sslMethod === 'upay' || method === 'cod') {
      await startSslCheckoutFromInitiate(data, {
        orderId,
        onPaid: () => {
          try { opts?.onPaid?.(); } catch { /* ignore */ }
          // Navigate to order detail so customer sees under-verification / paid state
          try {
            const locale = (typeof window !== 'undefined' && window.location.pathname.split('/')[1]) || 'en';
            window.location.href = `/${locale}/account/orders/${orderId}`;
          } catch {
            /* ignore */
          }
        },
      });
      return data;
    }

    return data;
  } catch (error: any) {
    const message = error?.response?.data?.error;
    throw new Error(message || `Could not start ${method} payment. Please try again.`);
  }
}
