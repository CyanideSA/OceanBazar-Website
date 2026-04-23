'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { X, ShoppingBag, Minus, Plus, Trash2, Tag, ArrowRight } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useCartStore } from '@/stores/cartStore';
import { cartApi } from '@/lib/api';
import { getMediaUrl } from '@/lib/mediaUrl';
import { previewOrderTotals } from '@/lib/checkoutTotals';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';

export default function CartDrawer() {
  const t = useTranslations('cart');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { cart, isOpen, setOpen, setCart, appliedCoupon, setAppliedCoupon, appliedObPoints } = useCartStore();
  const [couponInput, setCouponInput] = useState('');
  const { success, error: toastError } = useToast();

  const updateMutation = useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: number; quantity: number }) =>
      cartApi.update(itemId, quantity).then((r) => r.data),
    onSuccess: setCart,
    onError: () => toastError(tc('error')),
  });

  const removeMutation = useMutation({
    mutationFn: (productId: string) => cartApi.remove(productId).then((r) => r.data),
    onSuccess: setCart,
    onError: () => toastError(tc('error')),
  });

  const couponMutation = useMutation({
    mutationFn: (code: string) =>
      cartApi.applyCoupon(code).then((r) => r.data as { coupon: { id: number; code: string; type: string; value: number } }),
    onSuccess: (data) => {
      setAppliedCoupon(data.coupon);
      setCouponInput('');
      success(t('couponApplied'));
    },
    onError: () => toastError(t('couponInvalid')),
  });

  const preview = useMemo(() => {
    if (!cart) return null;
    const ob = appliedObPoints?.bdtDiscount ?? 0;
    return previewOrderTotals(cart.subtotal, appliedCoupon, ob);
  }, [cart, appliedCoupon, appliedObPoints]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop — blurs the rest of the screen */}
      <div
        className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[6px] transition-opacity duration-300"
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* Drawer — slides from right, half-screen on desktop, 85% on mobile */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-[70] flex flex-col bg-background text-foreground shadow-2xl',
          'w-[85vw] max-w-[50vw] border-l border-border/60',
          'animate-slide-in-right',
          'max-[640px]:max-w-[85vw]',
        )}
        role="dialog"
        aria-modal
        aria-labelledby="cart-drawer-title"
      >

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-5 sm:py-4">
          <h2 id="cart-drawer-title" className="flex items-center gap-2.5 text-base font-bold sm:text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <ShoppingBag className="h-4 w-4 text-primary" />
            </div>
            {t('title')}
            {cart && cart.itemCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {cart.itemCount}
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:h-11 sm:w-11"
            aria-label="Close cart"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
          {!cart || cart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="font-medium text-muted-foreground">{t('empty')}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-3 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
              >
                {t('continueShopping')}
              </button>
            </div>
          ) : (
            <ul className="space-y-3 sm:space-y-4">
              {cart.items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3 rounded-xl border border-border/40 bg-card p-3 transition-colors hover:border-border sm:gap-4 sm:p-4"
                >
                  {/* Image */}
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-24 sm:w-24">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getMediaUrl(item.image)} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground/30">
                        <ShoppingBag className="h-8 w-8" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground sm:text-base">{item.title}</p>
                    <p className="mt-1 text-sm font-bold text-primary sm:mt-1.5">
                      {tc('taka')}{item.unitPrice.toLocaleString()}
                    </p>
                    {item.discountPct > 0 && (
                      <span className="inline-block rounded-full bg-success/10 px-1.5 py-0.5 text-2xs font-semibold text-success">-{item.discountPct}% {t('off')}</span>
                    )}

                    {/* Quantity controls - bigger on mobile */}
                    <div className="mt-2.5 flex items-center gap-2 sm:mt-3">
                      <button
                        type="button"
                        onClick={() => updateMutation.mutate({ itemId: item.id, quantity: item.quantity - 1 })}
                        className="flex h-10 w-10 items-center justify-center rounded-md border border-border/60 text-foreground transition-colors hover:bg-accent active:bg-accent/70 sm:h-9 sm:w-9"
                        aria-label={t('decreaseQty')}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-[2rem] text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateMutation.mutate({ itemId: item.id, quantity: item.quantity + 1 })}
                        className="flex h-10 w-10 items-center justify-center rounded-md border border-border/60 text-foreground transition-colors hover:bg-accent active:bg-accent/70 sm:h-9 sm:w-9"
                        aria-label={t('increaseQty')}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Right side - remove + line total */}
                  <div className="flex flex-col items-end justify-between">
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate(item.productId)}
                      className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive sm:h-9 sm:w-9"
                      aria-label={t('remove')}
                    >
                      <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                    <p className="text-sm font-bold text-foreground sm:text-base">
                      {tc('taka')}{item.lineTotal.toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {cart && cart.items.length > 0 && (
          <div className="space-y-3 border-t border-border/60 bg-background/95 px-4 py-4 backdrop-blur-sm sm:space-y-4 sm:px-5 sm:py-5" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            {/* Coupon */}
            <div className="rounded-xl border border-border/40 bg-muted/30 p-3 sm:p-3.5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Tag className="h-3.5 w-3.5" />
                {t('coupon')}
              </p>
              <div className="flex gap-2">
                <input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder={t('enterCode')}
                  className={cn(
                    'min-w-0 flex-1 rounded-lg border border-border/60 bg-background px-3 py-2.5 text-sm uppercase',
                    'placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30',
                  )}
                />
                <button
                  type="button"
                  disabled={!couponInput.trim() || couponMutation.isPending}
                  onClick={() => couponMutation.mutate(couponInput.trim())}
                  className="shrink-0 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50 sm:px-5"
                >
                  {t('applyCoupon')}
                </button>
              </div>
              {appliedCoupon && (
                <button
                  type="button"
                  onClick={() => setAppliedCoupon(null)}
                  className="mt-2 text-xs text-destructive transition-colors hover:underline"
                >
                  {t('remove')} {appliedCoupon.code}
                </button>
              )}
            </div>

            {/* Totals */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>{t('subtotal')}</span>
                <span className="font-medium text-foreground">{tc('taka')}{cart.subtotal.toLocaleString()}</span>
              </div>
              {preview && preview.discount > 0 && (
                <div className="flex justify-between text-success">
                  <span>{t('discount')}</span>
                  <span className="font-medium">-{tc('taka')}{preview.discount.toLocaleString()}</span>
                </div>
              )}
              {appliedObPoints && (
                <div className="flex justify-between text-primary">
                  <span>{t('pointsApplied')}</span>
                  <span>-{tc('taka')}{appliedObPoints.bdtDiscount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>{t('gst')}</span>
                <span className="font-medium text-foreground">{tc('taka')}{(preview?.gst ?? cart.gst).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>{t('shipping')}</span>
                <span className="font-medium text-foreground">
                  {(preview?.shippingFee ?? cart.shippingFee) === 0 ? (
                    <span className="text-success">{t('freeShipping')}</span>
                  ) : (
                    `${tc('taka')}${preview?.shippingFee ?? cart.shippingFee}`
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border/40 pt-3">
              <span className="text-base font-bold text-foreground">{t('total')}</span>
              <span className="text-xl font-extrabold text-primary">
                {tc('taka')}{(preview?.total ?? cart.total).toLocaleString()}
              </span>
            </div>

            <p className="text-2xs text-muted-foreground">{t('cartEstimateNote')}</p>

            <Link
              href={`/${locale}/checkout`}
              onClick={() => setOpen(false)}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-bold text-primary-foreground',
                'shadow-soft transition-all hover:shadow-glow-primary hover:brightness-110 active:scale-[0.98] min-h-[52px] sm:py-4',
              )}
            >
              <span className="flex items-center gap-2">
                {t('checkout')}
                <ArrowRight className="h-4 w-4" />
              </span>
              <span className="mx-2 h-4 w-px bg-white/30" />
              <span>{tc('taka')}{(preview?.total ?? cart.total).toLocaleString()}</span>
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
