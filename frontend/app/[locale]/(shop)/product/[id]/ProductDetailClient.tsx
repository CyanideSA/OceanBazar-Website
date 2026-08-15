'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { useShopRouter } from '@/lib/shopNavigation';
import Link from 'next/link';
import { AlertTriangle, Truck, Bell, Shield } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { productsApi, cartApi, stockNotifyApi } from '@/lib/api';
import { useCartStore } from '@/stores/cartStore';
import { useAuthStore } from '@/stores/authStore';
import { isIosSafari, isIosWebKit } from '@/lib/iosSafari';
import { debugSessionLog } from '@/lib/debugSessionLog';
import { calculatePrice } from '@/lib/pricing';
import PricingBlock from '@/components/product/PricingBlock';
import ProductZoomGallery from '@/components/product/ProductZoomGallery';
import ProductVariantSelectors from '@/components/product/ProductVariantSelectors';
import ProductStarRating from '@/components/product/ProductStarRating';
import ProductDetailTabs from '@/components/product/ProductDetailTabs';
import ProductBannerCarousel from '@/components/product/ProductBannerCarousel';
import ProductRelatedSections from '@/components/product/ProductRelatedSections';
import ProductActionsBar from '@/components/product/ProductActionsBar';
import type { ProductDetail } from '@/types';
import { filterImagesByColor, formatVariantLabel, pickVariant, requiresVariantSelection, slugColorKey } from '@/lib/variants';
import { getMediaUrl } from '@/lib/mediaUrl';
import { useTrackRecentlyViewed } from '@/hooks/useRecentlyViewed';
import RecentlyViewedProducts from '@/components/product/RecentlyViewedProducts';
import SizeGuideModal from '@/components/product/SizeGuideModal';

function normalizeProductDetail(raw: Record<string, any>): ProductDetail {
  const d = (raw.product ?? raw) as Record<string, any>;
  return {
    ...d,
    title: d.title ?? d.name ?? '',
    description: d.description ?? null,
    categoryId: d.categoryId ?? d.category ?? '',
    status: d.status ?? 'active',
    moq: d.moq ?? 1,
    stock: d.stock ?? 0,
    tags: Array.isArray(d.tags) ? d.tags : [],
    trustBadges: Array.isArray(d.trustBadges) ? d.trustBadges : [],
    primaryImage: d.primaryImage ?? d.image ?? null,
    images: Array.isArray(d.richImages)
      ? d.richImages.map((img: any) => ({
          id: img.id,
          url: img.url,
          altEn: img.altEn ?? null,
          altBn: img.altBn ?? null,
          sortOrder: img.sortOrder ?? 0,
          mediaType: img.mediaType ?? 'image',
          isPrimary: img.isPrimary ?? false,
          colorKey: img.colorKey ?? null,
        }))
      : Array.isArray(d.images)
        ? d.images.map((item: any, i: number) => {
            if (typeof item === 'string') {
              return {
                id: i,
                url: item,
                altEn: null,
                altBn: null,
                sortOrder: i,
                mediaType: 'image' as const,
                isPrimary: i === 0,
                colorKey: null,
              };
            }
            return {
              id: item.id ?? i,
              url: item.url,
              altEn: item.altEn ?? null,
              altBn: item.altBn ?? null,
              sortOrder: item.sortOrder ?? i,
              mediaType: item.mediaType ?? 'image',
              isPrimary: item.isPrimary ?? i === 0,
              colorKey: item.colorKey ?? null,
            };
          })
        : [],
    richImages: undefined,
    retailPrice: d.retailPrice ?? null,
    wholesalePrice: d.wholesalePrice ?? null,
    pricing: d.pricing ?? { retail: null, wholesale: null },
    ratingAvg: d.rating ?? d.ratingAvg ?? null,
    ratingCount: d.ratingCount ?? 0,
    reviewCount: d.ratingCount ?? d.reviewCount ?? 0,
    reviews: Array.isArray(d.reviews) ? d.reviews : [],
    variants: d.variants ?? [],
    specifications: d.specifications ?? null,
    attributes: d.attributes ?? null,
    brandLogoUrl: d.brandLogoUrl ?? null,
    popularityRank: d.popularityRank ?? null,
    popularityLabel: d.popularityLabel ?? null,
    hasFreeShipping: Boolean(d.hasFreeShipping ?? d.freeShipping ?? false),
    banners: Array.isArray(d.banners) ? d.banners : [],
  } as ProductDetail;
}

interface Props {
  productId: string;
  locale: string;
  /** Server-fetched product so old phones can paint without waiting on a second client API round-trip. */
  initialProduct?: Record<string, unknown> | null;
}

export default function ProductDetailClient({ productId, locale, initialProduct }: Props) {
  const t = useTranslations('product');
  const td = useTranslations('productDetail');
  const tc = useTranslations('common');
  const setCart = useCartStore((s) => s.setCart);
  const setOpen = useCartStore((s) => s.setOpen);
  const addLocalItem = useCartStore((s) => s.addLocalItem);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const { success, error: toastError } = useToast();
  const router = useShopRouter();

  const [activeImage, setActiveImage] = useState(0);
  const [colorSlug, setColorSlug] = useState<string | null>(null);
  const [sizeSel, setSizeSel] = useState<string | null>(null);
  const [styleSel, setStyleSel] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'description' | 'specs' | 'attributes' | 'tags' | 'reviews' | 'qa'>('description');
  const [stickyQty, setStickyQty] = useState(1);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySent, setNotifySent] = useState(false);

  const seededProduct = initialProduct
    ? normalizeProductDetail(initialProduct as Record<string, any>)
    : undefined;

  useEffect(() => {
    // #region agent log
    debugSessionLog({
      hypothesisId: 'H10',
      location: 'ProductDetailClient.tsx:mount',
      message: 'product detail client mounted',
      data: {
        productId,
        locale,
        ios: isIosWebKit(),
        hasInitial: Boolean(seededProduct),
      },
      runId: 'post-test-ssr-product',
    });
    // #endregion
  }, [productId, locale, seededProduct]);

  const { data: product, isLoading, error, isFetching, status } = useQuery({
    queryKey: ['product', productId, locale],
    queryFn: async () => {
      try {
        const r = await productsApi.get(productId, locale);
        // #region agent log
        debugSessionLog({
          hypothesisId: 'H10',
          location: 'ProductDetailClient.tsx:queryFn-ok',
          message: 'product API resolved',
          data: { productId, status: r.status, hasData: Boolean(r.data) },
          runId: 'post-test-ssr-product',
        });
        // #endregion
        const raw = r.data as Record<string, any>;
        return normalizeProductDetail(raw);
      } catch (err) {
        // #region agent log
        debugSessionLog({
          hypothesisId: 'H10',
          location: 'ProductDetailClient.tsx:queryFn-fail',
          message: 'product API failed',
          data: {
            productId,
            errMsg: err instanceof Error ? err.message.slice(0, 160) : String(err).slice(0, 160),
            status: (err as { response?: { status?: number } })?.response?.status ?? null,
          },
          runId: 'post-test-ssr-product',
        });
        // #endregion
        throw err;
      }
    },
    initialData: seededProduct,
    staleTime: 60_000,
  });

  const variants = product?.variants ?? [];
  const matchedVariant = useMemo(
    () => pickVariant(variants, colorSlug, sizeSel, styleSel),
    [variants, colorSlug, sizeSel, styleSel]
  );

  const allImages = product?.images ?? [];

  const visibleImages = useMemo(() => {
    if (!allImages.length) return [];
    if (colorSlug) {
      const byColor = filterImagesByColor(allImages, colorSlug);
      if (byColor.some((i) => i.colorKey)) return byColor;
    }
    if (styleSel) {
      const byStyle = filterImagesByColor(allImages, slugColorKey(styleSel));
      if (byStyle.some((i) => i.colorKey)) return byStyle;
    }
    if (sizeSel) {
      const bySize = filterImagesByColor(allImages, slugColorKey(sizeSel));
      if (bySize.some((i) => i.colorKey)) return bySize;
    }
    return allImages;
  }, [allImages, colorSlug, styleSel, sizeSel]);

  useEffect(() => {
    setActiveImage(0);
  }, [colorSlug, styleSel, sizeSel, visibleImages.length]);

  const effectiveStock = useMemo(() => {
    if (!product) return 0;
    if (matchedVariant) return matchedVariant.stock;
    if (variants.length === 1) return variants[0].stock;
    if (variants.length > 1) return variants.reduce((s, v) => s + v.stock, 0) || product.stock;
    return product.stock;
  }, [product, matchedVariant, variants]);

  const variantPriceOverride = matchedVariant?.priceOverride ?? null;
  const needsVariantPick = requiresVariantSelection(variants) && !matchedVariant;
  const variantIdForCart = matchedVariant?.id ?? (variants.length === 1 ? variants[0].id : null);
  /** Stock for ATC limits — never force 0 while options are unselected. */
  const showOutOfStock = !needsVariantPick && effectiveStock === 0;

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7896/ingest/89e60d83-694f-49b3-8a65-19c43e3fa97c', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e24651' },
      body: JSON.stringify({
        sessionId: 'e24651',
        runId: 'pdp-options',
        hypothesisId: 'C',
        location: 'ProductDetailClient.tsx:stock-options',
        message: 'PDP stock/option state',
        data: {
          productId,
          variantCount: variants.length,
          colorSlug,
          styleSel,
          sizeSel,
          needsVariantPick,
          effectiveStock,
          showOutOfStock,
          visibleImageCount: visibleImages.length,
          keyedImageCount: visibleImages.filter((i) => i.colorKey).length,
          specEntryCount: Array.isArray((product as any)?.specificationsEntries)
            ? (product as any).specificationsEntries.length
            : Object.keys(product?.specifications || {}).length,
          attrEntryCount: Array.isArray((product as any)?.attributesEntries)
            ? (product as any).attributesEntries.length
            : Object.keys(product?.attributes || {}).length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }, [
    productId,
    variants.length,
    colorSlug,
    styleSel,
    sizeSel,
    needsVariantPick,
    effectiveStock,
    showOutOfStock,
    visibleImages,
    product,
  ]);
  // #endregion

  const addMutation = useMutation({
    mutationFn: async (args: { qty: number; variantId?: string | null }) => {
      const id = product?.id || productId;
      if (!isAuthenticated) {
        const userType = user?.userType ?? 'retail';
        const unit =
          variantPriceOverride ??
          (product?.pricing
            ? calculatePrice(userType, product.pricing, args.qty, product?.moq).unitPrice
            : null) ??
          product?.pricing?.retail?.price ??
          product?.retailPrice ??
          0;
        return addLocalItem({
          productId: id,
          title: product?.title || 'Product',
          image: product?.primaryImage ?? null,
          unitPrice: typeof unit === 'number' ? unit : 0,
          quantity: args.qty,
          variantId: args.variantId ?? null,
          variantLabel: matchedVariant
            ? formatVariantLabel(matchedVariant.attributes, matchedVariant.name)
            : null,
          stock: effectiveStock,
          moq: product?.moq,
          retailMaxQty: (product?.pricing?.retail as { maxQty?: number } | undefined)?.maxQty ?? null,
        });
      }
      return cartApi.add(id, args.qty, args.variantId ?? undefined);
    },
    onError: (err: any) => {
      const status = err?.response?.status;
      if (status === 401) toastError('Please sign in at checkout to complete your order');
      else if (status === 404) toastError('This product is currently unavailable');
      else toastError(tc('error'));
    },
  });

  // Track recently viewed
  const retailPrice = product?.pricing?.retail?.price ?? product?.retailPrice ?? null;
  useTrackRecentlyViewed(product?.id ?? '', product?.title, product?.primaryImage, typeof retailPrice === 'number' ? retailPrice : null);

  useEffect(() => {
    // #region agent log
    debugSessionLog({
      hypothesisId: 'H2',
      location: 'ProductDetailClient.tsx:query-state',
      message: 'product query state',
      data: {
        productId,
        isLoading,
        isFetching,
        status,
        hasProduct: Boolean(product),
        errName: error instanceof Error ? error.name : null,
        errMsg: error instanceof Error ? error.message.slice(0, 160) : null,
      },
    });
    // #endregion
  }, [productId, isLoading, isFetching, status, product, error]);

  if (isLoading) {
    return (
      <div className="container-tight py-8" data-ob-debug="product-skeleton">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-2xl bg-muted" />
          <div className="space-y-4">
            <div className="h-8 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-12 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    // #region agent log
    debugSessionLog({
      hypothesisId: 'H6',
      location: 'ProductDetailClient.tsx:notFound',
      message: 'product missing/error → notFound()',
      data: {
        productId,
        hasProduct: Boolean(product),
        errMsg: error instanceof Error ? error.message.slice(0, 160) : String(error ?? ''),
      },
    });
    // #endregion
    notFound();
  }

  const orderCount = product.orderCount ?? 0;
  const ratingAvg = product.ratingAvg ?? 0;
  const reviewCount = product.ratingCount ?? product.reviewCount ?? 0;
  const reviews = product.reviews ?? [];
  const tag = product.tags?.[0];
  const brandLogo = product.brandLogoUrl ? getMediaUrl(product.brandLogoUrl) : null;
  const catIcon = product.category?.icon ? getMediaUrl(product.category.icon) : null;

  return (
    <>
    <div className="container-tight pb-28 pt-4 sm:pb-6 sm:pt-6 lg:pb-10 lg:pt-10">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-12">
        <ProductZoomGallery
          images={visibleImages.length ? visibleImages : allImages}
          title={product.title}
          activeIndex={activeImage}
          onSelectIndex={setActiveImage}
        />

        <div className="space-y-4">

          {/* ── Brand + Title + SKU ── */}
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              {brandLogo ? (
                <Image src={brandLogo} alt="" width={32} height={32} className="rounded object-contain" unoptimized />
              ) : null}
              {product.brand && <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{product.brand}</p>}
              {tag && (
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
                  {tag}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">{product.title}</h1>
            {product.sku && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('sku')}: <span className="font-medium">{matchedVariant?.sku ?? product.sku}</span>
              </p>
            )}
            {Array.isArray(product.trustBadges) && product.trustBadges.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2" data-ob-product-trust={String(product.trustBadges.length)}>
                {product.trustBadges.map((badge) => {
                  const label = locale === 'bn' ? badge.nameBn || badge.nameEn : badge.nameEn;
                  return (
                    <Link
                      key={badge.id || badge.slug}
                      href={`/${locale}/products?trustBadge=${encodeURIComponent(badge.slug)}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
                    >
                      <Shield className="h-3.5 w-3.5" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* ── Rating + Orders on one row ── */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <ProductStarRating value={ratingAvg} count={reviewCount} />
            <span className="h-4 w-px bg-border" />
            <span>
              {td('sold')}: <strong className="text-foreground">{orderCount.toLocaleString()}</strong>
            </span>
            {matchedVariant?.name && (
              <>
                <span className="h-4 w-px bg-border" />
                <span>{td('variant')}: <strong className="text-foreground">{matchedVariant.name}</strong></span>
              </>
            )}
          </div>

          {/* ── Wishlist | Compare | Share | Free Shipping — one row ── */}
          <div className="flex flex-wrap items-center gap-2">
            <ProductActionsBar productId={product.id} title={product.title} />
            {product.hasFreeShipping && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                <Truck className="h-4 w-4" />
                {td('freeShippingQuota')}
              </span>
            )}
          </div>

          {/* ── Popularity badge ── */}
          {(product.popularityLabel || product.popularityRank) && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 dark:bg-amber-500/5">
              {catIcon && <Image src={catIcon} alt="" width={32} height={32} className="rounded object-contain" unoptimized />}
              <div>
                {product.popularityRank != null && (
                  <p className="text-xs font-semibold uppercase text-amber-800 dark:text-amber-200">
                    #{product.popularityRank} {td('inCategory')}
                  </p>
                )}
                {product.popularityLabel && (
                  <p className="text-sm font-medium text-foreground">{product.popularityLabel}</p>
                )}
              </div>
            </div>
          )}

          {/* ── Variant selectors ── */}
          <ProductVariantSelectors
            variants={variants}
            selectedColorSlug={colorSlug}
            selectedSize={sizeSel}
            selectedStyle={styleSel}
            onColor={setColorSlug}
            onSize={setSizeSel}
            onStyle={setStyleSel}
            onReset={() => { setColorSlug(null); setSizeSel(null); setStyleSel(null); }}
          />
          {needsVariantPick && (
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              {td('selectOption')}
            </p>
          )}

          {/* ── Stock warnings (never show OOS while options still unselected) ── */}
          {!needsVariantPick && effectiveStock > 0 && effectiveStock < 10 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{td('onlyLeft', { n: effectiveStock })}</p>
            </div>
          )}
          {showOutOfStock && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                <p className="text-sm font-semibold text-destructive">{tc('outOfStock')}</p>
              </div>
              {!notifySent ? (
                <div className="flex gap-2">
                  <input
                    type="email" placeholder="Enter email for restock alert"
                    value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button type="button"
                    disabled={!notifyEmail}
                    onClick={async () => {
                      try {
                        await stockNotifyApi.subscribe(product!.id, notifyEmail);
                        setNotifySent(true);
                        success("We'll notify you when it's back in stock!");
                      } catch { toastError('Could not save. Try again.'); }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                    <Bell className="h-4 w-4" /> Notify Me
                  </button>
                </div>
              ) : (
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">✅ You'll be notified when back in stock</p>
              )}
            </div>
          )}

          <PricingBlock
            product={product}
            variantPriceOverride={variantPriceOverride}
            effectiveStock={effectiveStock}
            selectionRequired={needsVariantPick}
            variantId={variantIdForCart}
            onAddToCart={(qty, vid) => {
              if (needsVariantPick) {
                toastError(td('selectOption'));
                return;
              }
              if (qty > effectiveStock) {
                toastError(tc('outOfStock'));
                return;
              }
              addMutation.mutate(
                { qty, variantId: vid },
                {
                  onSuccess: (data) => {
                    try {
                      setCart(data);
                      if (isIosSafari()) success(t('addedToCart'));
                      else {
                        setOpen(true);
                        success(t('addedToCart'));
                      }
                    } catch {
                      toastError(tc('error'));
                    }
                  },
                }
              );
            }}
            onBuyNow={async (qty, vid) => {
              if (needsVariantPick) {
                toastError(td('selectOption'));
                return;
              }
              if (qty > effectiveStock) {
                toastError(tc('outOfStock'));
                return;
              }
              const data = await addMutation.mutateAsync({ qty, variantId: vid });
              setCart(data);
              router.push(`/${locale}/checkout`);
            }}
          />
        </div>
      </div>

      {product.banners && product.banners.length > 0 && (
        <div className="mt-8">
          <ProductBannerCarousel banners={product.banners} />
        </div>
      )}

      <ProductDetailTabs
        product={product}
        tab={detailTab}
        onTab={setDetailTab as any}
        reviews={reviews}
      />

      <RecentlyViewedProducts excludeId={product.id} />

      <ProductRelatedSections productId={product.id} categoryId={product.categoryId} />

      {sizeGuideOpen && <SizeGuideModal onClose={() => setSizeGuideOpen(false)} />}
    </div>

    {/* ── Sticky bottom bar — mobile only ── */}
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 px-4 pb-[env(safe-area-inset-bottom,0px)] pt-3 sm:hidden"
      style={{ backgroundColor: 'hsl(var(--background, 0 0% 100%))' }}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center overflow-hidden rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setStickyQty((q) => Math.max(1, q - 1))}
            className="flex h-10 w-10 items-center justify-center text-lg font-medium text-foreground transition-colors hover:bg-muted"
          >−</button>
          <span className="flex h-10 w-10 items-center justify-center border-x border-border text-sm font-semibold">{stickyQty}</span>
          <button
            type="button"
            onClick={() => setStickyQty((q) => Math.min(q + 1, Math.max(1, effectiveStock)))}
            className="flex h-10 w-10 items-center justify-center text-lg font-medium text-foreground transition-colors hover:bg-muted"
          >+</button>
        </div>
        <button
          type="button"
          disabled={showOutOfStock}
          onClick={() => {
            if (needsVariantPick) {
              toastError(td('selectOption'));
              return;
            }
            addMutation.mutate(
              { qty: stickyQty, variantId: variantIdForCart },
              {
                onSuccess: (data) => {
                  try {
                    setCart(data);
                    if (isIosSafari()) success(t('addedToCart'));
                    else {
                      setOpen(true);
                      success(t('addedToCart'));
                    }
                  } catch {
                    toastError(tc('error'));
                  }
                },
              }
            );
          }}
          className="flex h-11 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-soft transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          {showOutOfStock ? tc('outOfStock') : t('addToCart')}
        </button>
        <button
          type="button"
          disabled={showOutOfStock}
          onClick={async () => {
            if (needsVariantPick) {
              toastError(td('selectOption'));
              return;
            }
            const data = await addMutation.mutateAsync({ qty: stickyQty, variantId: variantIdForCart });
            setCart(data);
            router.push(`/${locale}/checkout`);
          }}
          className="flex h-11 items-center justify-center rounded-lg border-2 border-primary px-4 text-sm font-bold text-primary transition-all hover:bg-primary/10 active:scale-[0.98] disabled:opacity-50"
        >
          {t('buyNow')}
        </button>
      </div>
    </div>
    </>
  );
}
