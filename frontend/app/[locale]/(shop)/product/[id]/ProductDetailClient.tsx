'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import { notFound } from 'next/navigation';
import { useShopRouter } from '@/lib/shopNavigation';
import { AlertTriangle, Truck, Bell } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { productsApi, cartApi, stockNotifyApi } from '@/lib/api';
import { useCartStore } from '@/stores/cartStore';
import PricingBlock from '@/components/product/PricingBlock';
import ProductZoomGallery from '@/components/product/ProductZoomGallery';
import ProductVariantSelectors from '@/components/product/ProductVariantSelectors';
import ProductStarRating from '@/components/product/ProductStarRating';
import ProductDetailTabs from '@/components/product/ProductDetailTabs';
import ProductBannerCarousel from '@/components/product/ProductBannerCarousel';
import ProductRelatedSections from '@/components/product/ProductRelatedSections';
import ProductActionsBar from '@/components/product/ProductActionsBar';
import type { ProductDetail } from '@/types';
import { filterImagesByColor, pickVariant } from '@/lib/variants';
import { getMediaUrl } from '@/lib/mediaUrl';
import { useTrackRecentlyViewed } from '@/hooks/useRecentlyViewed';
import RecentlyViewedProducts from '@/components/product/RecentlyViewedProducts';
import SizeGuideModal from '@/components/product/SizeGuideModal';
interface Props {
  productId: string;
  locale: string;
}

export default function ProductDetailClient({ productId, locale }: Props) {
  const t = useTranslations('product');
  const td = useTranslations('productDetail');
  const tc = useTranslations('common');
  const { setCart, setOpen } = useCartStore();
  const { success, error: toastError } = useToast();
  const router = useShopRouter();

  const [activeImage, setActiveImage] = useState(0);
  const [colorSlug, setColorSlug] = useState<string | null>(null);
  const [sizeSel, setSizeSel] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'description' | 'specs' | 'attributes' | 'tags' | 'reviews' | 'qa'>('description');
  const [stickyQty, setStickyQty] = useState(1);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySent, setNotifySent] = useState(false);

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', productId, locale],
    queryFn: () =>
      productsApi.get(productId, locale).then((r) => {
        const raw = r.data as Record<string, any>;
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
            : (Array.isArray(d.images)
              ? d.images.map((item: any, i: number) => {
                  if (typeof item === 'string') return { id: i, url: item, altEn: null, altBn: null, sortOrder: i, mediaType: 'image' as const, isPrimary: i === 0, colorKey: null };
                  return { id: item.id ?? i, url: item.url, altEn: item.altEn ?? null, altBn: item.altBn ?? null, sortOrder: item.sortOrder ?? i, mediaType: item.mediaType ?? 'image', isPrimary: item.isPrimary ?? i === 0, colorKey: item.colorKey ?? null };
                })
              : []),
          richImages: undefined,
          retailPrice: d.retailPrice ?? null,
          wholesalePrice: d.wholesalePrice ?? null,
          pricing: d.pricing ?? { retail: null, wholesale: null },
          ratingAvg: d.rating ?? null,
          ratingCount: d.ratingCount ?? 0,
          reviewCount: d.ratingCount ?? 0,
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
      }),
  });

  const addMutation = useMutation({
    mutationFn: (args: { qty: number; variantId?: string | null }) =>
      cartApi.add(product?.id || productId, args.qty, args.variantId ?? undefined).then((r) => r.data),
    onError: (err: any) => {
      const status = err?.response?.status;
      if (status === 401) toastError('Please log in to add items to cart');
      else if (status === 404) toastError('This product is currently unavailable');
      else toastError(tc('error'));
    },
  });

  const variants = product?.variants ?? [];
  const matchedVariant = useMemo(
    () => pickVariant(variants, colorSlug, sizeSel),
    [variants, colorSlug, sizeSel]
  );

  const allImages = product?.images ?? [];

  const visibleImages = useMemo(() => {
    if (!allImages.length) return [];
    return filterImagesByColor(allImages, colorSlug);
  }, [allImages, colorSlug]);

  useEffect(() => {
    setActiveImage(0);
  }, [colorSlug, visibleImages.length]);

  const effectiveStock = useMemo(() => {
    if (!product) return 0;
    if (matchedVariant) return matchedVariant.stock;
    if (variants.length === 1) return variants[0].stock;
    if (variants.length > 1) return variants.reduce((s, v) => s + v.stock, 0) || product.stock;
    return product.stock;
  }, [product, matchedVariant, variants]);

  const variantPriceOverride = matchedVariant?.priceOverride ?? null;
  const variantIdForCart = matchedVariant?.id ?? (variants.length === 1 ? variants[0].id : null);

  // Track recently viewed
  const retailPrice = product?.pricing?.retail?.price ?? product?.retailPrice ?? null;
  useTrackRecentlyViewed(product?.id ?? '', product?.title, product?.primaryImage, typeof retailPrice === 'number' ? retailPrice : null);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
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
    <div className="mx-auto max-w-7xl px-3 pb-28 pt-4 sm:px-6 sm:pb-6 sm:pt-6 lg:px-8 lg:pb-10 lg:pt-10">
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
            onColor={setColorSlug}
            onSize={setSizeSel}
            onReset={() => { setColorSlug(null); setSizeSel(null); }}
          />

          {/* ── Stock warnings ── */}
          {effectiveStock > 0 && effectiveStock < 10 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{td('onlyLeft', { n: effectiveStock })}</p>
            </div>
          )}
          {effectiveStock === 0 && (
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
            variantId={variantIdForCart}
            onAddToCart={(qty, vid) =>
              addMutation.mutate(
                { qty, variantId: vid },
                {
                  onSuccess: (data) => {
                    setCart(data);
                    setOpen(true);
                    success(t('addedToCart'));
                  },
                }
              )
            }
            onBuyNow={async (qty, vid) => {
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
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 px-4 pb-[env(safe-area-inset-bottom,0px)] pt-3 backdrop-blur-sm sm:hidden">
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
          disabled={effectiveStock === 0}
          onClick={() =>
            addMutation.mutate(
              { qty: stickyQty, variantId: variantIdForCart },
              {
                onSuccess: (data) => {
                  setCart(data);
                  setOpen(true);
                  success(t('addedToCart'));
                },
              }
            )
          }
          className="flex h-11 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-soft transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          {effectiveStock === 0 ? tc('outOfStock') : t('addToCart')}
        </button>
        <button
          type="button"
          disabled={effectiveStock === 0}
          onClick={async () => {
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
