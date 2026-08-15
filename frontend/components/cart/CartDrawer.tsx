'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { X, ShoppingBag, Minus, Plus, Trash2, Tag, ArrowRight } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useCartStore } from '@/stores/cartStore';
import { useAuthStore } from '@/stores/authStore';
import { cartApi } from '@/lib/api';
import { formatCartMoney } from '@/lib/cart';
import { formatApiErrorMessage } from '@/lib/formatApiError';
import { RETAIL_MAX_UNITS } from '@/lib/pricing';
import type { CartItem } from '@/types';
import { useNormalizedCart } from '@/hooks/useNormalizedCart';
import { getMediaUrl } from '@/lib/mediaUrl';
import { previewOrderTotals } from '@/lib/checkoutTotals';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { isIosWebKit } from '@/lib/iosSafari';

export default function CartDrawer() {
  const t = useTranslations('cart');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { isOpen, setOpen, setCart, appliedCoupon, setAppliedCoupon, appliedObPoints, updateLocalQty, removeLocalItem } = useCartStore();
  const [couponInput, setCouponInput] = useState('');
  const [mounted, setMounted] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const { success, error: toastError } = useToast();

  const safeCart = useNormalizedCart();
  const { user, isAuthenticated } = useAuthStore();
  const isWholesaleUser = user?.userType === 'wholesale';

  // Keep mounted through close so the panel can slide back toward the cart button (right edge).
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      setPanelOpen(false);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setPanelOpen(true));
      });
      // #region agent log
      fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'cart-anim',hypothesisId:'H1',location:'CartDrawer.tsx:open',message:'cart drawer open sequence',data:{isOpen:true,ios:isIosWebKit()},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setPanelOpen(false);
    // #region agent log
    fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'cart-anim',hypothesisId:'H1',location:'CartDrawer.tsx:close',message:'cart drawer close sequence',data:{isOpen:false},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const id = window.setTimeout(() => setMounted(false), 320);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  useEffect(() => {
    if (!mounted || !panelOpen) return;
    // body { overflow:hidden } blanks the compositor on old iOS WebKit — skip there.
    if (isIosWebKit()) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted, panelOpen]);

  // Same per-product cap as the product page: retail tier-3 threshold from the
  // admin CRM (falling back to the global retail cap), bounded by stock.
  const maxQtyFor = (item: CartItem): number => {
    const stock = item.stock != null && item.stock > 0 ? item.stock : null;
    if (isWholesaleUser) return stock ?? Number.MAX_SAFE_INTEGER;
    const retailCap = item.retailMaxQty != null && item.retailMaxQty > 0 ? item.retailMaxQty : RETAIL_MAX_UNITS;
    return Math.max(1, stock != null ? Math.min(retailCap, stock) : retailCap);
  };

  const updateMutation = useMutation({
    mutationFn: async ({ productId, quantity, variantId }: { productId: string; quantity: number; variantId?: string | null }) => {
      // #region agent log
      fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'pre-fix',hypothesisId:'H2',location:'CartDrawer.tsx:updateMutationFn',message:'cart qty update start',data:{productId,quantity,variantId:variantId??null,auth:isAuthenticated},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (!isAuthenticated) return updateLocalQty(productId, quantity, variantId);
      return cartApi.update(productId, quantity, variantId);
    },
    onSuccess: (data) => {
      // #region agent log
      fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'post-fix',hypothesisId:'H2',location:'CartDrawer.tsx:updateOnSuccess',message:'cart qty update success',data:{itemCount:data?.itemCount??null,items:(data?.items||[]).slice(0,3).map((i)=>({productId:i.productId,variantId:i.variantId??null,qty:i.quantity,variantLabel:i.variantLabel??null}))},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setCart(data);
    },
    onError: (e: unknown) => {
      const ax = e as { response?: { status?: number; data?: { error?: unknown; message?: unknown; detail?: unknown } }; message?: string };
      const errVal = ax.response?.data?.error ?? ax.response?.data?.message ?? ax.response?.data?.detail ?? tc('error');
      const toastMsg = formatApiErrorMessage(errVal, tc('error'));
      // #region agent log
      fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e24651'},body:JSON.stringify({sessionId:'e24651',runId:'post-fix',hypothesisId:'H1',location:'CartDrawer.tsx:updateOnError',message:'cart qty update error → toast',data:{status:ax.response?.status??null,errType:typeof errVal,errKeys:errVal&&typeof errVal==='object'?Object.keys(errVal as object).slice(0,8):[],toastMsg:toastMsg.slice(0,160)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      toastError(toastMsg);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ productId, variantId }: { productId: string; variantId?: string | null }) => {
      if (!isAuthenticated) return removeLocalItem(productId, variantId);
      return cartApi.remove(productId, variantId);
    },
    onSuccess: setCart,
    onError: (e: unknown) => {
      const ax = e as { response?: { data?: { error?: unknown; message?: unknown; detail?: unknown } } };
      toastError(formatApiErrorMessage(ax.response?.data?.error ?? ax.response?.data?.message ?? ax.response?.data?.detail ?? tc('error'), tc('error')));
    },
  });

  const changeQuantity = (item: CartItem, nextQty: number) => {
    if (nextQty <= 0) {
      removeMutation.mutate({ productId: item.productId, variantId: item.variantId });
      return;
    }
    const clamped = Math.min(nextQty, maxQtyFor(item));
    if (clamped === item.quantity) return;
    updateMutation.mutate({ productId: item.productId, quantity: clamped, variantId: item.variantId });
  };

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
    if (!safeCart) return null;
    const ob = appliedObPoints?.bdtDiscount ?? 0;
    return previewOrderTotals(safeCart.subtotal, appliedCoupon, ob, {
      retailQuantityOrder: safeCart.retailQuantityOrder,
    });
  }, [safeCart, appliedCoupon, appliedObPoints]);

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop — color transition only (no opacity:0) */}
      <div
        className={cn('ob-cart-backdrop fixed inset-0 z-[60]', panelOpen && 'is-open')}
        onClick={() => setOpen(false)}
        aria-hidden
        data-ob-cart-backdrop="1"
        data-ob-cart-open={panelOpen ? '1' : '0'}
      />

      {/*
        Drawer slides in/out from the right edge (cart button side).
        Transform-only motion; literal colors so paint never depends on CSS vars.
      */}
      <div
        className={cn(
          'ob-cart-panel fixed inset-y-0 right-0 z-[70] flex w-[85%] max-w-[400px] flex-col border-l border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50',
          panelOpen && 'is-open',
        )}
        role="dialog"
        aria-modal
        aria-labelledby="cart-drawer-title"
        data-ob-cart-drawer="1"
        data-ob-cart-open={panelOpen ? '1' : '0'}
      >

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-5 sm:py-4">
          <h2 id="cart-drawer-title" className="flex items-center gap-2.5 text-base font-bold sm:text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <ShoppingBag className="h-4 w-4 text-primary" />
            </div>
            {t('title')}
            {safeCart && safeCart.itemCount > 0 && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {safeCart.itemCount}
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
          {!safeCart || safeCart.items.length === 0 ? (
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
              {safeCart.items.map((item) => (
                <li
                  key={`${item.productId}:${item.variantId ?? 'base'}`}
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
                    {item.variantLabel ? (
                      <p className="mt-0.5 text-xs font-medium text-muted-foreground">{item.variantLabel}</p>
                    ) : null}
                    <p className="mt-1 text-sm font-bold text-primary sm:mt-1.5">
                      {tc('taka')}{formatCartMoney(item.unitPrice)}
                    </p>
                    {(item.discountPct ?? 0) > 0 && (
                      <span className="inline-block rounded-full bg-success/10 px-1.5 py-0.5 text-2xs font-semibold text-success">-{item.discountPct}% {t('off')}</span>
                    )}

                    {/* Quantity controls - bigger on mobile */}
                    <div className="mt-2.5 flex items-center gap-2 sm:mt-3">
                      <button
                        type="button"
                        onClick={() => changeQuantity(item, item.quantity - 1)}
                        className="flex h-10 w-10 items-center justify-center rounded-md border border-border/60 text-foreground transition-colors hover:bg-accent active:bg-accent/70 sm:h-9 sm:w-9"
                        aria-label={t('decreaseQty')}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-[2rem] text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        type="button"
                        disabled={item.quantity >= maxQtyFor(item)}
                        onClick={() => changeQuantity(item, item.quantity + 1)}
                        className="flex h-10 w-10 items-center justify-center rounded-md border border-border/60 text-foreground transition-colors hover:bg-accent active:bg-accent/70 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
                        aria-label={t('increaseQty')}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      {item.quantity >= maxQtyFor(item) && (
                        <span className="text-2xs font-medium text-amber-600 dark:text-amber-400">{t('maxQtyReached')}</span>
                      )}
                    </div>
                  </div>

                  {/* Right side - remove + line total */}
                  <div className="flex flex-col items-end justify-between">
                    <button
                      type="button"
                      onClick={() => removeMutation.mutate({ productId: item.productId, variantId: item.variantId })}
                      className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive sm:h-9 sm:w-9"
                      aria-label={t('remove')}
                    >
                      <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                    <p className="text-sm font-bold text-foreground sm:text-base">
                      {tc('taka')}{formatCartMoney(item.lineTotal)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {safeCart && safeCart.items.length > 0 && (
          <div
            className="space-y-3 border-t border-border/60 bg-white px-4 py-4 dark:bg-slate-950 sm:space-y-4 sm:px-5 sm:py-5"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
          >
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
                  disabled={!couponInput.trim() || couponMutation.isPending || !isAuthenticated}
                  onClick={() => {
                    if (!isAuthenticated) {
                      toastError(t('couponLoginRequired'));
                      return;
                    }
                    couponMutation.mutate(couponInput.trim());
                  }}
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

            {/* Cart shows product value only — shipping/VAT calculated at checkout */}
            <div className="flex items-center justify-between border-t border-border/40 pt-3">
              <span className="text-base font-bold text-foreground">{t('total')}</span>
              <span className="text-xl font-extrabold text-primary">
                {tc('taka')}{formatCartMoney(safeCart.subtotal)}
              </span>
            </div>

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
              <span>{tc('taka')}{formatCartMoney(safeCart.subtotal)}</span>
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
