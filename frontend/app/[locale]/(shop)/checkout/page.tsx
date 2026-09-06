'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useShopRouter } from '@/lib/shopNavigation';
import { ChevronDown, Loader2, MapPin, Package, CreditCard, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';
import { useCartStore } from '@/stores/cartStore';
import { useAuthStore } from '@/stores/authStore';
import { useAuthHydrated } from '@/hooks/useAuthHydrated';
import { useUIStore } from '@/stores/uiStore';
import { cartApi, deliveryApi, ordersApi, profileApi } from '@/lib/api';
import { normalizeCartSummary } from '@/lib/cart';
import { canRetryOnlinePayment, startOrderPayment } from '@/lib/orderPayment';
import PaymentMethodSelector from '@/components/checkout/PaymentMethodSelector';
import AddressCheckoutSection from '@/components/checkout/AddressCheckoutSection';
import CheckoutObPointsPanel from '@/components/checkout/CheckoutObPointsPanel';
import CheckoutCouponSlider from '@/components/checkout/CheckoutCouponSlider';
import CheckoutRecommendations from '@/components/checkout/CheckoutRecommendations';
import GuestCheckoutPanel from '@/components/checkout/GuestCheckoutPanel';
import SslCommerzPopup from '@/components/checkout/SslCommerzPopup';
import { previewOrderTotals, checkoutMeta, formatVatPercent } from '@/lib/checkoutTotals';
import { isCodAllowed } from '@/lib/pricing';
import type { SavedAddress, CartSummary } from '@/types';
import { getMediaUrl } from '@/lib/mediaUrl';
import { cn } from '@/lib/utils';
import { AB_TESTS, trackAbOutcome, useAbVariant } from '@/lib/abTest';
import { cartItemsToGa4, trackGa4BeginCheckout, trackGa4Purchase } from '@/lib/ga4';
import { cartItemsToMeta, getMetaBrowserCookies, trackMetaInitiateCheckout, trackMetaPurchase } from '@/lib/metaPixel';

const PAY_RETRY_KEY = 'ob_pay_retry';

function persistPayRetry(value: { orderId: string; method: string; purpose?: 'order_total' | 'delivery_fee' } | null) {
  try {
    if (!value) sessionStorage.removeItem(PAY_RETRY_KEY);
    else sessionStorage.setItem(PAY_RETRY_KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function readStoredPayRetry(): { orderId: string; method: string; purpose?: 'order_total' | 'delivery_fee' } | null {
  try {
    const raw = sessionStorage.getItem(PAY_RETRY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { orderId?: string; method?: string; purpose?: string };
    if (!parsed?.orderId || !parsed?.method) return null;
    const purpose =
      parsed.purpose === 'delivery_fee' || parsed.purpose === 'order_total' ? parsed.purpose : undefined;
    return { orderId: parsed.orderId, method: parsed.method, purpose };
  } catch {
    return null;
  }
}

function CheckoutLoginRequired({
  locale,
  onGuestCheckout,
}: {
  locale: string;
  onGuestCheckout: () => void;
}) {
  const t = useTranslations('checkout');
  const loginVariant = useAbVariant(AB_TESTS.CHECKOUT_LOGIN);
  const setLoginDialogOpen = useUIStore((s) => s.setLoginDialogOpen);
  const cart = useCartStore((s) => s.cart);
  const itemCount = cart?.itemCount ?? 0;

  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <Package className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
      <h1 className="text-xl font-semibold text-foreground">{t('loginRequiredTitle')}</h1>
      {itemCount > 0 && (
        <p className="mt-3 text-sm font-medium text-foreground">
          {itemCount} {itemCount === 1 ? 'item' : 'items'} waiting in your cart
        </p>
      )}
      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => setLoginDialogOpen(true)}
          className="inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground"
        >
          {loginVariant === 'B' ? 'Sign in & keep my benefits' : t('loginToCheckout')}
        </button>
        <Link
          href={`/${locale}/auth/register?next=/${locale}/checkout`}
          className="inline-block rounded-xl border border-border px-6 py-3 font-semibold text-foreground hover:bg-accent"
        >
          {t('createAccountToCheckout')}
        </Link>
      </div>
      <button
        type="button"
        onClick={onGuestCheckout}
        className="mt-4 text-sm font-semibold text-primary hover:underline"
      >
        Checkout as guest
      </button>
    </div>
  );
}

export default function CheckoutPage() {
  const t = useTranslations('checkout');
  const tExtra = useTranslations('checkoutExtra');
  const tPolicy = useTranslations('policies');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useShopRouter();
  const checkoutCtaVariant = useAbVariant(AB_TESTS.CHECKOUT_CTA);
  const couponVariant = useAbVariant(AB_TESTS.COUPON_DISCOVERY);
  const { cart, appliedCoupon, appliedObPoints, setCart, clearCart, setAppliedCoupon } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const authHydrated = useAuthHydrated();

  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [payRetry, setPayRetry] = useState<{ orderId: string; method: string; purpose?: 'order_total' | 'delivery_fee' } | null>(null);
  const [retryingPayment, setRetryingPayment] = useState(false);
  const [policiesAgreed, setPoliciesAgreed] = useState(false);
  const [courierShippingFee, setCourierShippingFee] = useState<number | null>(null);
  const [courierQuoteLoading, setCourierQuoteLoading] = useState(false);
  const [courierQuoteError, setCourierQuoteError] = useState('');
  const [sslGatewayUrl, setSslGatewayUrl] = useState<string | null>(null);
  const [sslSessionKey, setSslSessionKey] = useState<string | null>(null);
  const [sslOrderId, setSslOrderId] = useState<string | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  /* Mobile step expansion state */
  const [openSteps, setOpenSteps] = useState<Set<string>>(new Set(['address', 'payment', 'summary']));
  const placedRef = useRef(false);
  const abandonSentRef = useRef(false);
  const pendingGa4PurchaseRef = useRef<{
    transactionId: string;
    value: number;
    items: ReturnType<typeof cartItemsToGa4>;
    shipping?: number;
    tax?: number;
    coupon?: string;
    paymentType: string;
  } | null>(null);
  const checkoutIntentRef = useRef({
    selectedAddressId: null as number | null,
    paymentMethod: '',
    policiesAgreed: false,
    notes: '',
    couponId: undefined as number | undefined,
    obPoints: 0,
    itemCount: 0,
  });

  const { setOpen: setCartOpen } = useCartStore();
  const beginCheckoutSent = useRef(false);

  // Close cart drawer on checkout mount
  useEffect(() => {
    setCartOpen(false);
  }, [setCartOpen]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('guest') === '1') setGuestMode(true);
    const payment = params.get('payment');
    const orderId = params.get('orderId');
    const method = params.get('method') || 'sslcommerz';
    if (payment === 'success') {
      persistPayRetry(null);
      return;
    }
    const failedReturn = payment === 'failed' || payment === 'cancelled' || payment === 'error' || payment === 'invalid';
    if (failedReturn) {
      setError(t('paymentReturnedFailed'));
    }
    const retryMethod = method === 'cod' ? 'sslcommerz' : method;
    if (failedReturn && orderId && (canRetryOnlinePayment(retryMethod) || retryMethod === 'sslcommerz')) {
      const next: { orderId: string; method: string; purpose?: 'order_total' | 'delivery_fee' } = {
        orderId,
        method: String(retryMethod),
        purpose: 'order_total',
      };
      setPayRetry(next);
      persistPayRetry(next);
      setPaymentMethod(retryMethod);
      return;
    }
    persistPayRetry(null);
    setPayRetry(null);
  }, [t]);

  async function retryExistingPayment() {
    if (!payRetry || retryingPayment) return;
    setRetryingPayment(true);
    setError('');
    try {
      persistPayRetry({ ...payRetry, purpose: 'order_total' });
      const pay = await startOrderPayment(payRetry.orderId, payRetry.method, {
        purpose: 'order_total',
      });
      if (!pay.redirectUrl) throw new Error(t('paymentInitFailed'));
      setSslGatewayUrl(pay.redirectUrl);
      setSslSessionKey(pay.sessionkey || null);
      setSslOrderId(payRetry.orderId);
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : t('paymentInitFailed'));
      setRetryingPayment(false);
    }
  }

  const { data: cartData, isLoading: cartLoading, isError: cartError, error: cartQueryError } = useQuery({
    queryKey: ['cart'],
    enabled: isAuthenticated,
    queryFn: async () => {
      const summary = await cartApi.get();
      return summary ?? normalizeCartSummary({ items: [] });
    },
    retry: (failureCount, err) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) return false;
      return failureCount < 2;
    },
  });

  useEffect(() => {
    if (!cartData) return;
    const localIds = (cart?.items || []).map((i) => i.productId);
    const queryIds = (cartData.items || []).map((i) => i.productId);
    setCart(cartData);
  }, [cartData, setCart]);

  const { data: addressData, isLoading: addrLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn: async () => {
      const r = await profileApi.addresses();
      const data = r.data as { addresses: SavedAddress[] };
      return data;
    },
  });

  const addresses = addressData?.addresses ?? [];
  const activeCart = cart ?? cartData;

  useEffect(() => {
    if (!addresses.length) {
      setSelectedAddressId(null);
      return;
    }
    setSelectedAddressId((prev) => {
      if (prev && addresses.some((a) => a.id === prev)) return prev;
      return addresses.find((a) => a.isDefault)?.id ?? addresses[0].id;
    });
  }, [addresses]);

  useEffect(() => {
    if (!selectedAddressId || !isAuthenticated) {
      setCourierShippingFee(null);
      setCourierQuoteError('');
      return;
    }
    const addr = addresses.find((a) => a.id === selectedAddressId);
    if (!addr?.pathaoCityId || !addr?.pathaoZoneId) {
      setCourierShippingFee(null);
      setCourierQuoteError('');
      return;
    }
    let cancelled = false;
    setCourierQuoteLoading(true);
    setCourierQuoteError('');
    deliveryApi
      .pathaoQuote({
        shippingAddressId: selectedAddressId,
        itemCount: activeCart?.itemCount ?? activeCart?.items?.length ?? 1,
      })
      .then((r) => {
        if (cancelled) return;
        const price = Number(r.data?.quote?.price);
        setCourierShippingFee(Number.isFinite(price) ? price : null);
      })
      .catch(() => {
        if (cancelled) return;
        // Keep cart preview shipping (৳25) when Pathao is down; never show axios 404 text.
        setCourierShippingFee(null);
        setCourierQuoteError('');
      })
      .finally(() => {
        if (!cancelled) setCourierQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAddressId, addresses, isAuthenticated, activeCart?.itemCount, activeCart?.items?.length]);

  const totalsPreview = useMemo(() => {
    if (!activeCart) return null;
    const ob = appliedObPoints?.bdtDiscount ?? 0;
    const base = previewOrderTotals(activeCart.subtotal, appliedCoupon, ob, {
      retailQuantityOrder: activeCart.retailQuantityOrder,
    });
    if (courierShippingFee == null || base.shippingFee === 0) return base;
    const delta = courierShippingFee - base.shippingFee;
    return {
      ...base,
      shippingFee: courierShippingFee,
      total: Math.max(0, base.total + delta),
    };
  }, [activeCart, appliedCoupon, appliedObPoints, courierShippingFee]);

  const orderTotal = totalsPreview?.total ?? 0;
  const displayShippingFee = totalsPreview?.shippingFee ?? 0;
  const codOk = isCodAllowed(orderTotal);
  /** Required for Pay Now (SSLCommerz) and Pay Later (COD). */
  const needsPolicyAgreement = Boolean(paymentMethod);

  checkoutIntentRef.current = {
    selectedAddressId,
    paymentMethod,
    policiesAgreed,
    notes,
    couponId: appliedCoupon?.id,
    obPoints: appliedObPoints?.points ?? 0,
    itemCount: activeCart?.items?.length ?? 0,
  };

  useEffect(() => {
    if (beginCheckoutSent.current) return;
    if (!activeCart?.items?.length) return;
    beginCheckoutSent.current = true;
    void trackAbOutcome('begin_checkout', { metadata: { locale } });
    const checkoutValue = Number(activeCart.total ?? orderTotal ?? 0);
    const ga4Items = cartItemsToGa4(activeCart.items);
    trackGa4BeginCheckout({
      value: checkoutValue,
      items: ga4Items,
      ...(appliedCoupon?.code ? { coupon: appliedCoupon.code } : {}),
    });
    trackMetaInitiateCheckout({
      value: checkoutValue,
      items: cartItemsToMeta(
        (activeCart.items || []).map((i: { productId: string; unitPrice?: number; quantity?: number }) => ({
          productId: i.productId,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
        })),
      ),
    });
  }, [activeCart, appliedCoupon?.code, locale, orderTotal]);

  useEffect(() => {
    const saveAbandoned = () => {
      const intent = checkoutIntentRef.current;
      if (placedRef.current || abandonSentRef.current) return;
      if (!intent.selectedAddressId || !intent.paymentMethod || !intent.itemCount) return;
      if (!intent.policiesAgreed) return;
      abandonSentRef.current = true;
      void ordersApi
        .place({
          shippingAddressId: intent.selectedAddressId,
          paymentMethod: intent.paymentMethod,
          couponId: intent.couponId,
          obPointsToRedeem: intent.obPoints,
          notes: intent.notes,
          policiesAgreed: true,
          abandonedCheckout: true,
        })
        .then(() => {
          useCartStore.getState().clearCart();
        })
        .catch(() => {
          abandonSentRef.current = false;
        });
    };
    const onPageHide = () => saveAbandoned();
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, []);

  const couponMutation = useMutation({
    mutationFn: (code: string) => cartApi.applyCoupon(code).then((r) => r.data as { coupon: { id: number; code: string; type: string; value: number } }),
    onSuccess: (data) => {
      setAppliedCoupon(data.coupon);
      setCouponInput('');
      setError('');
    },
    onError: (e: unknown) => {
      setError((e as { response?: { data?: { error?: string } } }).response?.data?.error ?? tc('error'));
    },
  });

  const placeMutation = useMutation({
    mutationFn: () => {
      if (!policiesAgreed) {
        throw new Error(tExtra('agreePoliciesRequired'));
      }
      return ordersApi
        .place({
          shippingAddressId: selectedAddressId,
          paymentMethod,
          couponId: appliedCoupon?.id,
          obPointsToRedeem: appliedObPoints?.points ?? 0,
          notes,
          policiesAgreed: true,
          ...getMetaBrowserCookies(),
        })
        .then((r) => r.data as {
          order: { id: string };
          requiresPayment: boolean;
          paymentPurpose?: 'order_total' | 'delivery_fee';
          deliveryFee?: number;
        });
    },
    onSuccess: async (data) => {
      const { order, requiresPayment } = data;
      void trackAbOutcome('order_placed', {
        value: orderTotal,
        idempotencyKey: order.id,
        metadata: {
          paymentMethod,
          usedCoupon: Boolean(appliedCoupon),
          usedObPoints: Boolean(appliedObPoints),
          paymentPurpose: 'order_total',
        },
      });
      pendingGa4PurchaseRef.current = {
        transactionId: order.id,
        value: orderTotal,
        items: cartItemsToGa4(activeCart?.items || []),
        shipping: displayShippingFee,
        tax: Number(totalsPreview?.gst ?? 0),
        ...(appliedCoupon?.code ? { coupon: appliedCoupon.code } : {}),
        paymentType: paymentMethod || 'unknown',
      };
      const orderHref = `/${locale}/account/orders/${order.id}`;
      const settleAfterOrder = async () => {
        try {
          await ordersApi.get(order.id);
        } catch {
          /* Route still shows skeleton/error UI; don't block overlay forever */
        }
      };

      const needsGateway = Boolean(requiresPayment) && paymentMethod !== 'cod';

      if (needsGateway && paymentMethod && paymentMethod !== 'installment') {
        try {
          placedRef.current = true;
          persistPayRetry(null);
          const purpose = 'order_total' as const;
          const payMethod = paymentMethod;
          const pay = await startOrderPayment(order.id, payMethod, { purpose });
          if (pay.redirectUrl) {
            setSslGatewayUrl(pay.redirectUrl);
            setSslSessionKey(pay.sessionkey || null);
            setSslOrderId(order.id);
            return;
          }
          setError(t('paymentInitFailed'));
          return;
        } catch (err: any) {
          const retry = {
            orderId: order.id,
            method: paymentMethod,
            purpose: 'order_total' as const,
          };
          setPayRetry(retry);
          persistPayRetry(retry);
          setError(err?.message || t('paymentInitFailed'));
          return;
        }
      }

      // COD / no gateway — count as purchase now
      if (pendingGa4PurchaseRef.current) {
        const purchase = pendingGa4PurchaseRef.current;
        trackGa4Purchase(purchase);
        trackMetaPurchase({
          orderId: purchase.transactionId,
          value: purchase.value,
          items: cartItemsToMeta(
            (purchase.items || []).map((it) => ({
              productId: it.item_id,
              unitPrice: it.price,
              quantity: it.quantity,
            })),
          ),
        });
        pendingGa4PurchaseRef.current = null;
      }
      placedRef.current = true;
      persistPayRetry(null);
      clearCart();
      router.push(orderHref, { settle: settleAfterOrder });
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { status?: number; data?: { error?: string; errors?: string[] } } };
      const fromList = ax.response?.data?.errors?.filter(Boolean).join(' ');
      setError(ax.response?.data?.error ?? fromList ?? tc('error'));
    },
  });

  const cartStatus = (cartQueryError as { response?: { status?: number } } | undefined)?.response?.status;

  const handleSslComplete = useCallback(
    (result: 'success' | 'failed' | 'cancelled' | 'unknown', redirectUrl?: string) => {
      setSslGatewayUrl(null);
      setSslSessionKey(null);
      if (result === 'success') {
        placedRef.current = true;
        persistPayRetry(null);
        if (pendingGa4PurchaseRef.current) {
          const purchase = pendingGa4PurchaseRef.current;
          trackGa4Purchase(purchase);
          trackMetaPurchase({
            orderId: purchase.transactionId,
            value: purchase.value,
            items: cartItemsToMeta(
              (purchase.items || []).map((it) => ({
                productId: it.item_id,
                unitPrice: it.price,
                quantity: it.quantity,
              })),
            ),
          });
          pendingGa4PurchaseRef.current = null;
        } else if (sslOrderId) {
          trackGa4Purchase({
            transactionId: sslOrderId,
            value: orderTotal,
            paymentType: paymentMethod || 'sslcommerz',
          });
          trackMetaPurchase({ orderId: sslOrderId, value: orderTotal });
        }
        clearCart();
        const orderHref = sslOrderId
          ? `/${locale}/account/orders/${sslOrderId}`
          : `/${locale}/payment/complete?status=success`;
        router.push(redirectUrl || orderHref);
      } else {
        setError(t('paymentReturnedFailed'));
        if (sslOrderId) {
          const retry = { orderId: sslOrderId, method: 'sslcommerz', purpose: 'order_total' as const };
          setPayRetry(retry);
          persistPayRetry(retry);
          setPaymentMethod('sslcommerz');
        }
      }
      setSslOrderId(null);
    },
    [clearCart, locale, orderTotal, paymentMethod, router, sslOrderId, t],
  );

  const handleSslClose = useCallback(() => {
    setSslGatewayUrl(null);
    setSslSessionKey(null);
    setError(t('paymentReturnedFailed'));
    if (sslOrderId) {
      const retry = { orderId: sslOrderId, method: 'sslcommerz', purpose: 'order_total' as const };
      setPayRetry(retry);
      persistPayRetry(retry);
    }
    setSslOrderId(null);
  }, [sslOrderId, t]);

  if (!authHydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        {tc('loading')}
      </div>
    );
  }

  if (!isAuthenticated && guestMode) {
    const guestCart = cart;
    if (!guestCart || guestCart.items.length === 0) {
      return (
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <Package className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
          <h1 className="text-xl font-semibold text-foreground">{t('emptyCartTitle')}</h1>
          <p className="mt-2 text-muted-foreground">{t('emptyCartHint')}</p>
          <Link href={`/${locale}/products`} className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground">
            {t('browseProducts')}
          </Link>
        </div>
      );
    }
    return (
      <GuestCheckoutPanel
        cart={guestCart}
        onBackToLogin={() => {
          setGuestMode(false);
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete('guest');
            window.history.replaceState({}, '', url.pathname + url.search);
          } catch { /* ignore */ }
        }}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <CheckoutLoginRequired
        locale={locale}
        onGuestCheckout={() => {
          setGuestMode(true);
          try {
            const url = new URL(window.location.href);
            url.searchParams.set('guest', '1');
            window.history.replaceState({}, '', url.pathname + url.search);
          } catch { /* ignore */ }
        }}
      />
    );
  }

  if (cartLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        {tc('loading')}
      </div>
    );
  }

  if (cartError && cartStatus === 401) {
    return (
      <CheckoutLoginRequired
        locale={locale}
        onGuestCheckout={() => setGuestMode(true)}
      />
    );
  }

  if (cartError || !activeCart) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <Package className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
        <h1 className="text-xl font-semibold text-foreground">{tc('error')}</h1>
        <p className="mt-2 text-muted-foreground">{t('cartLoadFailed')}</p>
        <Link href={`/${locale}/products`} className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground">
          {t('browseProducts')}
        </Link>
      </div>
    );
  }

  if (!activeCart || activeCart.items.length === 0) {
    if (payRetry) {
      return (
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <CreditCard className="mx-auto mb-4 h-16 w-16 text-primary/70" />
          <h1 className="text-xl font-semibold text-foreground">{t('paymentRetryTitle')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('paymentRecoveryHint')}</p>
          {error ? <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">{error}</p> : null}
          <button
            type="button"
            disabled={retryingPayment}
            onClick={retryExistingPayment}
            className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {retryingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {retryingPayment ? t('paymentRetrying') : t('paymentRetryCta')}
          </button>
          <div className="mt-4">
            <Link href={`/${locale}/account/orders/${payRetry.orderId}`} className="text-sm font-medium text-primary hover:underline">
              {t('viewPendingOrder')}
            </Link>
          </div>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <Package className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
        <h1 className="text-xl font-semibold text-foreground">{t('emptyCartTitle')}</h1>
        <p className="mt-2 text-muted-foreground">{t('emptyCartHint')}</p>
        <Link href={`/${locale}/products`} className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground">
          {t('browseProducts')}
        </Link>
      </div>
    );
  }

  const savingsLine =
    (appliedCoupon ? totalsPreview?.discount ?? 0 : 0) + (appliedObPoints?.bdtDiscount ?? 0);

  const policyLinkClass = 'font-medium text-foreground hover:text-primary hover:underline';
  const renderPolicyAgreement = (compact = false) => {
    if (!needsPolicyAgreement) return null;
    return (
      <div
        className={
          compact
            ? 'mb-2 text-[11px] leading-snug text-muted-foreground'
            : 'rounded-xl border border-border/60 bg-background p-2.5 text-xs text-muted-foreground sm:p-3'
        }
      >
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            required
            aria-required="true"
            checked={policiesAgreed}
            onChange={(e) => setPoliciesAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
          />
          <span>
            I have read and agree to the{' '}
            <Link href={`/${locale}/policies/terms`} className={policyLinkClass}>
              {tPolicy('termsConditions')}
            </Link>
            {', '}
            <Link href={`/${locale}/policies/privacy`} className={policyLinkClass}>
              {tPolicy('privacyPolicy')}
            </Link>
            {', '}
            <Link href={`/${locale}/policies/returns`} className={policyLinkClass}>
              {tPolicy('returnPolicy')}
            </Link>
            {', '}
            <Link href={`/${locale}/policies/refunds`} className={policyLinkClass}>
              {tPolicy('refundPolicy')}
            </Link>
            {' & '}
            <Link href={`/${locale}/policies/shipping`} className={policyLinkClass}>
              {tPolicy('shippingPolicy')}
            </Link>
            .
          </span>
        </label>
      </div>
    );
  };

  /* Order summary content - shared between mobile accordion and desktop sidebar */
  function renderSummaryContent() {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-lg sm:p-5">
        <h2 className="text-base font-semibold text-foreground sm:text-lg">{t('orderSummary')}</h2>

        <ul className="max-h-48 space-y-2 overflow-y-auto sm:max-h-64 sm:space-y-3">
          {activeCart?.items?.map((item) => (
            <li key={item.id} className="flex gap-3 text-sm">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-14 sm:w-14">
                {item.image ? (
                  <Image
                    src={getMediaUrl(item.image)}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-medium text-foreground">{item.title}</p>
                {item.variantLabel ? (
                  <p className="text-xs text-muted-foreground">{item.variantLabel}</p>
                ) : null}
                <p className="text-muted-foreground">
                  {tc('taka')}
                  {item.unitPrice.toLocaleString()} × {item.quantity}
                </p>
              </div>
              <p className="shrink-0 font-semibold text-foreground">
                {tc('taka')}
                {item.lineTotal.toLocaleString()}
              </p>
            </li>
          ))}
        </ul>

        <div className="space-y-1.5 border-t border-border pt-3 text-xs sm:space-y-2 sm:pt-4 sm:text-sm">
          {totalsPreview && totalsPreview.discount > 0 && (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>{t('lineItemsGross')}</span>
                <span className="font-medium text-foreground">
                  {tc('taka')}
                  {(activeCart?.subtotal ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>{t('lineCoupon')}</span>
                <span>
                  −{tc('taka')}
                  {totalsPreview.discount.toLocaleString()}
                </span>
              </div>
            </>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>{t('lineMerchandise')}</span>
            <span className="font-medium text-foreground">
              {tc('taka')}
              {(totalsPreview?.taxableAmount ?? activeCart?.subtotal ?? 0).toLocaleString()}
            </span>
          </div>
          {appliedObPoints && (
            <div className="flex justify-between text-primary">
              <span>{t('lineObPoints')}</span>
              <span>
                −{tc('taka')}
                {appliedObPoints.bdtDiscount.toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>{t('lineShipping')}</span>
            <span className="font-medium text-foreground">
              {courierQuoteLoading && displayShippingFee > 0 ? (
                <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Verifying delivery…</span>
              ) : displayShippingFee === 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400">{t('freeShipping')}</span>
              ) : (
                `${tc('taka')}${displayShippingFee.toLocaleString()}`
              )}
            </span>
          </div>
          {(() => {
            const subtotal = Number(activeCart?.subtotal ?? 0);
            const threshold = checkoutMeta.freeFeesThreshold;
            const retailOk = activeCart?.retailQuantityOrder !== false;
            if (!retailOk || displayShippingFee === 0 || subtotal >= threshold) return null;
            const remaining = Math.max(0, threshold - subtotal);
            return (
              <p className="rounded-lg bg-primary/5 px-2 py-1.5 text-xs text-foreground">
                {t('freeShipThresholdHint', {
                  amount: remaining.toLocaleString(),
                  threshold: threshold.toLocaleString(),
                })}
              </p>
            );
          })()}
          {courierQuoteError ? (
            <p className="text-xs text-amber-600">{courierQuoteError}</p>
          ) : null}
          {paymentMethod === 'cod' ? (
            <p className="rounded-lg bg-emerald-500/10 px-2 py-1.5 text-xs text-foreground">
              {t('payLaterSub')}
            </p>
          ) : null}
          <div className="flex justify-between text-muted-foreground">
            <span>{t('lineVat')}</span>
            <span className="font-medium text-foreground">
              {(totalsPreview?.gst ?? 0) === 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400">{t('vatWaived')}</span>
              ) : (
                <>
                  {tc('taka')}
                  {(totalsPreview?.gst ?? activeCart?.gst ?? 0).toLocaleString()}
                </>
              )}
            </span>
          </div>
          {(totalsPreview?.gst ?? 0) > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground/80">
            <span>{t('lineVatHint', { pct: formatVatPercent(checkoutMeta.gstRate) })}</span>
          </div>
          )}
          {savingsLine > 0 && (
            <div className="flex justify-between rounded-lg bg-emerald-500/10 px-2 py-1.5 text-emerald-800 dark:text-emerald-200">
              <span className="font-medium">{t('lineSavings')}</span>
              <span className="font-bold">
                {tc('taka')}
                {savingsLine.toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2 text-sm font-bold text-foreground sm:pt-3 sm:text-base">
            <span>{t('totalDue')}</span>
            <span className="text-primary">
              {tc('taka')}
              {orderTotal.toLocaleString()}
            </span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{t('deliveryEstimate')}</p>
        <div className="rounded-xl border border-border bg-muted/30 p-2.5 text-xs text-muted-foreground sm:p-3 sm:text-sm">
          <p>{tExtra('orderProtectionNote')}</p>
          <p className="mt-1 sm:mt-2">{tExtra('deliveryInstruction')}</p>
        </div>

        <div className="border-t border-border pt-3 sm:pt-4">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:mb-2">{t('couponBox')}</p>
          <div className="flex gap-2">
            <input
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              placeholder={t('couponPlaceholder')}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm uppercase"
            />
            <button
              type="button"
              disabled={!couponInput.trim() || couponMutation.isPending}
              onClick={() => couponMutation.mutate(couponInput.trim())}
              className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50 sm:px-4"
            >
              {t('applyCoupon')}
            </button>
          </div>
          {appliedCoupon && (
            <button
              type="button"
              onClick={() => setAppliedCoupon(null)}
              className="mt-2 text-xs font-medium text-destructive hover:underline"
            >
              {t('removeCoupon')} ({appliedCoupon.code})
            </button>
          )}
        </div>

        {payRetry && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p className="font-medium text-amber-900 dark:text-amber-100">{t('paymentRetryTitle')}</p>
            <button
              type="button"
              className="mt-2 text-primary underline"
              disabled={retryingPayment}
              onClick={retryExistingPayment}
            >
              {retryingPayment ? t('paymentRetrying') : t('paymentRetryCta')}
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive">{error}</p>
            {(error.includes('not configured') || error.includes('COD')) && (
              <button
                type="button"
                onClick={() => { setError(''); setPaymentMethod('cod'); }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Switch to Cash on Delivery instead
              </button>
            )}
          </div>
        )}

        {renderPolicyAgreement()}

        {/* Desktop place order button */}
        <button
          type="button"
          disabled={
            payRetry
              ? retryingPayment
              : (
            !paymentMethod ||
            !selectedAddressId ||
            !policiesAgreed ||
            placeMutation.isPending ||
            addrLoading ||
            (paymentMethod === 'cod' && !codOk)
              )
          }
          onClick={() => (payRetry ? void retryExistingPayment() : placeMutation.mutate())}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-base font-bold text-white shadow-soft transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 min-h-[52px] sm:mt-4 sm:py-4 sm:text-lg ob-btn-brand-orange"
        >
          {placeMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {placeMutation.isPending ? tExtra('placingOrder') : (
            <>
              {checkoutCtaVariant === 'B' ? 'Pay securely' : t('placeOrder')}
              <span className="mx-1">·</span>
              {tc('taka')}{orderTotal.toLocaleString()}
            </>
          )}
        </button>
      </div>
    );
  }

  const toggleStep = (step: string) => {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      next.has(step) ? next.delete(step) : next.add(step);
      return next;
    });
  };

  /* Step header component for mobile */
  function StepHeader({ step, icon: Icon, title, isOpen, onClick, isComplete }: { step: string; icon: any; title: string; isOpen: boolean; onClick: () => void; isComplete?: boolean }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors sm:hidden',
          isOpen ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30'
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', isComplete ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
            <Icon className="h-4 w-4" />
          </div>
          <span className={cn('font-semibold', isComplete && 'text-primary')}>{title}</span>
        </div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
      </button>
    );
  }

  return (
    <>
    {sslGatewayUrl && (
      <SslCommerzPopup
        gatewayUrl={sslGatewayUrl}
        sessionkey={sslSessionKey || undefined}
        onComplete={handleSslComplete}
        onClose={handleSslClose}
      />
    )}
    <div className="container-tight pb-44 pt-3 sm:py-6 lg:py-10">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-border pb-3 sm:mb-5 sm:gap-3 sm:pb-4">
        <div>
          <p className="text-xs font-medium text-primary sm:text-sm">{t('checkoutBadge')}</p>
          <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl md:text-2xl">{t('title')}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{t('subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground sm:gap-4">
          <span className="inline-flex items-center gap-1">
            <Truck className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {t('trustShipping')}
          </span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> {t('trustSecure')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        {/* Main content - steps on mobile */}
        <div className="space-y-3 lg:col-span-7 lg:space-y-5">

          {/* STEP 1: Address */}
          <StepHeader step="address" icon={MapPin} title={t('shippingAddress')} isOpen={openSteps.has('address')} onClick={() => toggleStep('address')} isComplete={!!selectedAddressId} />
          <div className={cn('overflow-hidden transition-all', openSteps.has('address') ? 'block' : 'hidden sm:block')}>
            <AddressCheckoutSection
              addresses={addresses}
              selectedId={selectedAddressId}
              onSelect={(id) => { setSelectedAddressId(id); setOpenSteps((s) => { const n = new Set(s); n.add('payment'); return n; }); }}
            />
          </div>

          {/* STEP 2: Payment */}
          <StepHeader step="payment" icon={CreditCard} title={t('paymentMethod')} isOpen={openSteps.has('payment')} onClick={() => toggleStep('payment')} isComplete={!!paymentMethod} />
          <div className={cn('overflow-hidden transition-all', openSteps.has('payment') ? 'block' : 'hidden sm:block')}>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <h2 className="mb-3 text-base font-semibold text-foreground sm:text-lg">{t('paymentMethod')}</h2>
              <p className="mb-3 text-xs text-muted-foreground sm:mb-4 sm:text-sm">{tExtra('paymentInstruction')}</p>
              <PaymentMethodSelector orderTotal={orderTotal} selected={paymentMethod} onSelect={setPaymentMethod} />
              {!codOk && paymentMethod === 'cod' && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 sm:text-sm">{t('codBlockedHint')}</p>
              )}
            </div>
          </div>

          {/* STEP 3: Summary (mobile accordion) */}
          <StepHeader step="summary" icon={ShoppingBag} title={t('orderSummary')} isOpen={openSteps.has('summary')} onClick={() => toggleStep('summary')} />
          <div className={cn('lg:hidden', openSteps.has('summary') ? 'block' : 'hidden')}>
            {renderSummaryContent()}
          </div>

          <CheckoutObPointsPanel />

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 className="mb-2 text-base font-semibold text-foreground sm:mb-3 sm:text-lg">{t('notes')}</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 sm:px-4 sm:py-3"
              placeholder={t('notesPlaceholder')}
            />
          </div>

          {couponVariant === 'A' && <CheckoutCouponSlider onPickCode={(code) => setCouponInput(code)} />}

          <CheckoutRecommendations />
        </div>

        {/* Desktop Summary sidebar */}
        <div className="hidden lg:col-span-5 lg:block">
          <div className="lg:sticky lg:top-20">
            {renderSummaryContent()}
          </div>
        </div>
      </div>
    </div>

    {/* ── Sticky mobile place order bar ── */}
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 px-4 pb-[env(safe-area-inset-bottom,0px)] pt-2 backdrop-blur-sm sm:hidden">
      {renderPolicyAgreement(true)}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xs text-muted-foreground">{t('totalDue')}</span>
          <span className="text-lg font-bold text-primary">
            {tc('taka')}{orderTotal.toLocaleString()}
          </span>
        </div>
        <button
          type="button"
          disabled={
            payRetry
              ? retryingPayment
              : (
            !paymentMethod ||
            !selectedAddressId ||
            !policiesAgreed ||
            placeMutation.isPending ||
            addrLoading ||
            (paymentMethod === 'cod' && !codOk)
              )
          }
          onClick={() => (payRetry ? void retryExistingPayment() : placeMutation.mutate())}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white shadow-soft transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 min-h-[52px] ob-btn-brand-orange"
        >
          {placeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {placeMutation.isPending
            ? tExtra('placingOrder')
            : checkoutCtaVariant === 'B'
              ? 'Pay securely'
              : t('placeOrder')}
        </button>
      </div>
    </div>
    </>
  );
}
