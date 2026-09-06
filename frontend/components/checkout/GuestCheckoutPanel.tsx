'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Package } from 'lucide-react';
import PathaoVerifiedAddressForm, { type PathaoAddressValue } from '@/components/address/PathaoVerifiedAddressForm';
import PaymentMethodSelector from '@/components/checkout/PaymentMethodSelector';
import SslCommerzPopup from '@/components/checkout/SslCommerzPopup';
import { deliveryApi, ordersApi } from '@/lib/api';
import { normalizeSslGatewayUrl } from '@/lib/sslGatewayUrl';
import { previewOrderTotals, checkoutMeta, formatVatPercent } from '@/lib/checkoutTotals';
import { COD_LIMIT, isCodAllowed } from '@/lib/pricing';
import { getMediaUrl } from '@/lib/mediaUrl';
import { useCartStore } from '@/stores/cartStore';
import { useShopRouter } from '@/lib/shopNavigation';
import { cartItemsToGa4, trackGa4BeginCheckout, trackGa4Purchase } from '@/lib/ga4';
import { cartItemsToMeta, getMetaBrowserCookies, trackMetaInitiateCheckout, trackMetaPurchase } from '@/lib/metaPixel';
import type { CartSummary } from '@/types';

const emptyAddress: PathaoAddressValue = {
  label: 'Guest',
  line1: '',
  line2: '',
  postalCode: '',
  isDefault: false,
  pathaoCityId: null,
  pathaoZoneId: null,
  pathaoAreaId: null,
};

type Props = {
  cart: CartSummary;
  onBackToLogin: () => void;
};

export default function GuestCheckoutPanel({ cart, onBackToLogin }: Props) {
  const t = useTranslations('checkout');
  const tExtra = useTranslations('checkoutExtra');
  const tPolicy = useTranslations('policies');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useShopRouter();
  const clearCart = useCartStore((s) => s.clearCart);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState<PathaoAddressValue>(emptyAddress);
  const [pathaoNames, setPathaoNames] = useState({ city: '', zone: '', area: '' });
  const [paymentMethod, setPaymentMethod] = useState('sslcommerz');
  const [policiesAgreed, setPoliciesAgreed] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [courierShippingFee, setCourierShippingFee] = useState<number | null>(null);
  const [courierQuoteLoading, setCourierQuoteLoading] = useState(false);
  const [sslGatewayUrl, setSslGatewayUrl] = useState<string | null>(null);
  const [sslOrderId, setSslOrderId] = useState<string | null>(null);

  const totalsPreview = useMemo(() => {
    const base = previewOrderTotals(cart.subtotal, null, 0, {
      retailQuantityOrder: cart.retailQuantityOrder,
    });
    if (courierShippingFee == null || base.shippingFee === 0) return base;
    const delta = courierShippingFee - base.shippingFee;
    return {
      ...base,
      shippingFee: courierShippingFee,
      total: Math.max(0, base.total + delta),
    };
  }, [cart.subtotal, cart.retailQuantityOrder, courierShippingFee]);

  const orderTotal = totalsPreview.total;
  const codOk = isCodAllowed(orderTotal);
  const needsPolicyAgreement = Boolean(paymentMethod);

  useEffect(() => {
    const value = orderTotal;
    const items = cart.items || [];
    trackGa4BeginCheckout({
      value,
      items: cartItemsToGa4(items),
    });
    trackMetaInitiateCheckout({
      value,
      items: cartItemsToMeta(
        items.map((i) => ({
          productId: i.productId,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
        })),
      ),
    });
    // Fire once on guest checkout mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!address.pathaoCityId || !address.pathaoZoneId) {
      setCourierShippingFee(null);
      return;
    }
    let cancelled = false;
    setCourierQuoteLoading(true);
    deliveryApi
      .pathaoQuoteGeo({
        pathaoCityId: address.pathaoCityId,
        pathaoZoneId: address.pathaoZoneId,
        itemCount: cart.itemCount ?? cart.items.length,
      })
      .then((r) => {
        if (cancelled) return;
        const price = Number(r.data?.quote?.price);
        setCourierShippingFee(Number.isFinite(price) ? price : null);
      })
      .catch(() => {
        if (!cancelled) setCourierShippingFee(null);
      })
      .finally(() => {
        if (!cancelled) setCourierQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address.pathaoCityId, address.pathaoZoneId, cart.itemCount, cart.items.length]);

  useEffect(() => {
    if (!codOk && paymentMethod === 'cod') setPaymentMethod('sslcommerz');
  }, [codOk, paymentMethod]);

  const placeMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !email.trim() || !phone.trim()) {
        throw new Error('Please enter your name, email, and phone.');
      }
      if (!address.line1.trim() || !address.pathaoCityId || !address.pathaoZoneId) {
        throw new Error('Please complete a verified OceanBazar shipping address.');
      }
      if (!policiesAgreed) {
        throw new Error(tExtra('agreePoliciesRequired'));
      }
      if (paymentMethod === 'cod' && orderTotal > COD_LIMIT) {
        throw new Error(`COD is available for orders up to ৳${COD_LIMIT}.`);
      }

      const r = await ordersApi.placeGuest({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        paymentMethod,
        policiesAgreed: true,
        notes: notes.trim() || undefined,
        ...getMetaBrowserCookies(),
        shippingAddress: {
          line1: address.line1.trim(),
          line2: address.line2?.trim() || undefined,
          city: pathaoNames.city || 'Dhaka',
          district: pathaoNames.zone || 'Dhaka',
          postalCode: address.postalCode || undefined,
          pathaoCityId: address.pathaoCityId,
          pathaoZoneId: address.pathaoZoneId,
          pathaoAreaId: address.pathaoAreaId || undefined,
          pathaoCityName: pathaoNames.city || undefined,
          pathaoZoneName: pathaoNames.zone || undefined,
          pathaoAreaName: pathaoNames.area || undefined,
        },
        items: cart.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          variantId: i.variantId || undefined,
        })),
      });
      return r.data as {
        order: { id: string; orderNumber?: string };
        requiresPayment: boolean;
        redirectUrl?: string;
        guestEmail?: string;
      };
    },
    onSuccess: (data) => {
      const { order, requiresPayment } = data;
      const gatewayUrl = normalizeSslGatewayUrl(data);
      if (requiresPayment && paymentMethod === 'sslcommerz') {
        if (gatewayUrl) {
          setSslGatewayUrl(gatewayUrl);
          setSslOrderId(order.id);
          return;
        }
        setError(t('paymentInitFailed'));
        return;
      }
      trackGa4Purchase({
        transactionId: order.id,
        value: orderTotal,
        items: cartItemsToGa4(cart.items || []),
        paymentType: paymentMethod || 'cod',
      });
      trackMetaPurchase({
        orderId: order.id,
        value: orderTotal,
        items: cartItemsToMeta(
          (cart.items || []).map((i) => ({
            productId: i.productId,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
          })),
        ),
      });
      clearCart();
      router.push(
        `/${locale}/payment/complete?status=success&orderId=${order.id}&guest=1`,
      );
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { error?: string; errors?: string[] } }; message?: string };
      const fromList = ax.response?.data?.errors?.filter(Boolean).join(' ');
      setError(ax.response?.data?.error ?? fromList ?? ax.message ?? tc('error'));
    },
  });

  const handleSslClose = useCallback(() => {
    setSslGatewayUrl(null);
    setSslOrderId(null);
  }, []);

  const handleSslComplete = useCallback(
    (result: 'success' | 'failed' | 'cancelled' | 'unknown') => {
      setSslGatewayUrl(null);
      if (result === 'success') {
        trackGa4Purchase({
          transactionId: sslOrderId || `guest_${Date.now()}`,
          value: orderTotal,
          items: cartItemsToGa4(cart.items || []),
          paymentType: 'sslcommerz',
        });
        if (sslOrderId) {
          trackMetaPurchase({
            orderId: sslOrderId,
            value: orderTotal,
            items: cartItemsToMeta(
              (cart.items || []).map((i) => ({
                productId: i.productId,
                unitPrice: i.unitPrice,
                quantity: i.quantity,
              })),
            ),
          });
        }
        clearCart();
        router.push(
          sslOrderId
            ? `/${locale}/payment/complete?status=success&orderId=${sslOrderId}&guest=1`
            : `/${locale}/payment/complete?status=success&guest=1`,
        );
      } else {
        setError(t('paymentReturnedFailed'));
      }
      setSslOrderId(null);
    },
    [cart.items, clearCart, locale, orderTotal, router, sslOrderId, t],
  );

  const policyLinkClass = 'font-medium text-foreground hover:text-primary hover:underline';

  return (
    <div className="container-tight pb-10 pt-3 sm:py-6 lg:py-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-border pb-3 sm:mb-5 sm:gap-3 sm:pb-4">
        <div>
          <p className="text-xs font-medium text-primary sm:text-sm">{t('checkoutBadge')}</p>
          <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl md:text-2xl">
            Checkout as guest
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            No account needed — create one later to unlock OB Points and more.
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToLogin}
          className="text-sm font-medium text-primary hover:underline"
        >
          Sign in instead
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
        <div className="space-y-3 lg:col-span-7 lg:space-y-5">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 className="mb-4 text-base font-semibold text-foreground sm:text-lg">Contact</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-muted-foreground">Full name</span>
                <input
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Email</span>
                <input
                  type="email"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Phone</span>
                <input
                  type="tel"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  autoComplete="tel"
                  placeholder="01XXXXXXXXX"
                />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 className="mb-4 text-base font-semibold text-foreground sm:text-lg">{t('shippingAddress')}</h2>
            <PathaoVerifiedAddressForm
              value={address}
              onChange={setAddress}
              onResolvedNames={(names) =>
                setPathaoNames({
                  city: names.cityName || '',
                  zone: names.zoneName || '',
                  area: names.areaName || '',
                })
              }
              hideDefaultToggle
              hideLabelField
              labels={{
                addrLabel: t('addrLabel'),
                addrLine1: t('addrLine1'),
                addrLine2: t('addrLine2'),
                addrPostal: t('addrPostal'),
                addrDefault: t('addrDefault'),
                city: t('addrCity'),
                zone: t('addrDistrict'),
                area: t('addrArea'),
                citySelect: t('addrCitySelect'),
                zoneSelect: t('addrDistrictSelect'),
                areaSelect: t('addrAreaSelect'),
              }}
            />
          </section>

          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <h2 className="mb-4 text-base font-semibold text-foreground sm:text-lg">{t('paymentMethod')}</h2>
            <PaymentMethodSelector
              orderTotal={orderTotal}
              selected={paymentMethod}
              onSelect={setPaymentMethod}
            />
            {needsPolicyAgreement ? (
              <div className="mt-4 rounded-xl border border-border/60 bg-background p-3 text-xs text-muted-foreground">
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    required
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
            ) : null}
            <label className="mt-4 block text-sm">
              <span className="mb-1 block text-muted-foreground">{t('notes')}</span>
              <textarea
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('notesPlaceholder')}
              />
            </label>
          </section>
        </div>

        <aside className="space-y-4 lg:col-span-5">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5 lg:sticky lg:top-24">
            <h2 className="mb-3 text-base font-semibold text-foreground sm:text-lg">{t('orderSummary')}</h2>
            <ul className="mb-4 max-h-48 space-y-2 overflow-y-auto">
              {cart.items.map((item) => (
                <li key={`${item.productId}-${item.variantId || ''}`} className="flex gap-3 text-sm">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getMediaUrl(item.image)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Package className="m-auto mt-3 h-5 w-5 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-medium">{item.title}</p>
                    <p className="text-muted-foreground">
                      {tc('taka')}
                      {item.unitPrice.toLocaleString()} × {item.quantity}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="space-y-1.5 border-t border-border pt-3 text-xs sm:space-y-2 sm:pt-4 sm:text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{t('lineMerchandise')}</span>
                <span className="font-medium text-foreground">
                  {tc('taka')}
                  {(totalsPreview.taxableAmount ?? cart.subtotal).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>{t('lineShipping')}</span>
                <span className="font-medium text-foreground">
                  {courierQuoteLoading && (totalsPreview.shippingFee ?? 0) > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Verifying delivery…
                    </span>
                  ) : (totalsPreview.shippingFee ?? 0) === 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400">{t('freeShipping')}</span>
                  ) : (
                    `${tc('taka')}${(totalsPreview.shippingFee ?? 0).toLocaleString()}`
                  )}
                </span>
              </div>
              {(() => {
                const subtotal = Number(cart.subtotal ?? 0);
                const threshold = checkoutMeta.freeFeesThreshold;
                const retailOk = cart.retailQuantityOrder !== false;
                if (!retailOk || (totalsPreview.shippingFee ?? 0) === 0 || subtotal >= threshold) return null;
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
              {paymentMethod === 'cod' ? (
                <p className="rounded-lg bg-emerald-500/10 px-2 py-1.5 text-xs text-foreground">{t('payLaterSub')}</p>
              ) : null}
              <div className="flex justify-between text-muted-foreground">
                <span>{t('lineVat')}</span>
                <span className="font-medium text-foreground">
                  {(totalsPreview.gst ?? 0) === 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400">{t('vatWaived')}</span>
                  ) : (
                    <>
                      {tc('taka')}
                      {(totalsPreview.gst ?? 0).toLocaleString()}
                    </>
                  )}
                </span>
              </div>
              {(totalsPreview.gst ?? 0) > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground/80">
                  <span>{t('lineVatHint', { pct: formatVatPercent(checkoutMeta.gstRate) })}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-sm font-bold text-foreground sm:pt-3 sm:text-base">
                <span>{t('totalDue')}</span>
                <span className="text-primary">
                  {tc('taka')}
                  {orderTotal.toLocaleString()}
                </span>
              </div>
              <p className="pt-1 text-[11px] text-muted-foreground">
                Guest checkout does not earn or redeem OB Points.
              </p>
            </div>
            <button
              type="button"
              disabled={placeMutation.isPending || !policiesAgreed || (paymentMethod === 'cod' && !codOk)}
              onClick={() => {
                setError('');
                placeMutation.mutate();
              }}
              className="mt-4 flex w-full min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 ob-btn-brand-orange hover:brightness-105"
            >
              {placeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {paymentMethod === 'sslcommerz' ? t('payNow') : t('placeOrder')}
            </button>
          </div>
        </aside>
      </div>

      {sslGatewayUrl ? (
        <SslCommerzPopup
          gatewayUrl={sslGatewayUrl}
          onClose={handleSslClose}
          onComplete={handleSslComplete}
        />
      ) : null}
    </div>
  );
}
