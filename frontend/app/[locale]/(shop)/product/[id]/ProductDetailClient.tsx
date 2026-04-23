'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import { notFound, useRouter } from 'next/navigation';
import { AlertTriangle, Package, ShieldCheck, Truck } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { productsApi, cartApi } from '@/lib/api';
import { useCartStore } from '@/stores/cartStore';
import PricingBlock from '@/components/product/PricingBlock';
import ProductZoomGallery from '@/components/product/ProductZoomGallery';
import ProductVariantSelectors from '@/components/product/ProductVariantSelectors';
import ProductStarRating from '@/components/product/ProductStarRating';
import ProductDetailTabs from '@/components/product/ProductDetailTabs';
import ProductRelatedSections from '@/components/product/ProductRelatedSections';
import ProductActionsBar from '@/components/product/ProductActionsBar';
import type { ProductDetail } from '@/types';
import { filterImagesByColor, pickVariant } from '@/lib/variants';
import { getMediaUrl } from '@/lib/mediaUrl';
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
  const router = useRouter();

  const [activeImage, setActiveImage] = useState(0);
  const [colorSlug, setColorSlug] = useState<string | null>(null);
  const [sizeSel, setSizeSel] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'description' | 'specs' | 'attributes' | 'tags' | 'reviews'>('description');
  const [stickyQty, setStickyQty] = useState(1);

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
        } as ProductDetail;
      }),
  });

  const addMutation = useMutation({
    mutationFn: (args: { qty: number; variantId?: string | null }) =>
      cartApi.add(productId, args.qty, args.variantId ?? undefined).then((r) => r.data),
    onError: () => toastError(tc('error')),
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

        <div className="space-y-5">
          {tag && (
            <span className="inline-block rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              {tag}
            </span>
          )}

          <div>
            <div className="mb-2 flex flex-wrap items-center gap-3">
              {brandLogo ? (
                <Image src={brandLogo} alt="" width={40} height={40} className="rounded-md object-contain" unoptimized />
              ) : null}
              {product.brand && <p className="text-sm font-medium text-muted-foreground">{product.brand}</p>}
            </div>
            <h1 className="text-xl font-bold leading-tight text-foreground sm:text-2xl md:text-3xl">{product.title}</h1>
            {product.sku && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('sku')}: {matchedVariant?.sku ?? product.sku}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span>
              {td('sold')}: <strong className="text-foreground">{orderCount.toLocaleString()}</strong>
            </span>
            {matchedVariant?.name && (
              <span>
                {td('variant')}: <strong className="text-foreground">{matchedVariant.name}</strong>
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <ProductStarRating value={ratingAvg} count={reviewCount} />
          </div>

          {(product.popularityLabel || product.popularityRank) && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 dark:bg-amber-500/5">
              {catIcon && <Image src={catIcon} alt="" width={36} height={36} className="rounded-md object-contain" unoptimized />}
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

          <div className="flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 font-medium text-emerald-800 dark:text-emerald-300">
              <Truck className="h-4 w-4" />
              {td('freeShippingOver')}
            </span>
          </div>

          <div className="flex flex-wrap gap-3 border-y border-border py-3 text-sm text-muted-foreground sm:gap-4 sm:py-4">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {td('orderProtection')}
            </span>
            <span className="inline-flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              {td('genuineProduct')}
            </span>
          </div>

          <ProductVariantSelectors
            variants={variants}
            selectedColorSlug={colorSlug}
            selectedSize={sizeSel}
            onColor={setColorSlug}
            onSize={setSizeSel}
            onReset={() => {
              setColorSlug(null);
              setSizeSel(null);
            }}
          />

          {effectiveStock > 0 && effectiveStock < 10 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">{td('onlyLeft', { n: effectiveStock })}</p>
            </div>
          )}
          {effectiveStock === 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm font-semibold text-destructive">{tc('outOfStock')}</p>
            </div>
          )}

          <ProductActionsBar productId={product.id} title={product.title} />

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

      <ProductDetailTabs
        product={product}
        tab={detailTab}
        onTab={setDetailTab}
        reviews={reviews}
      />

      <ProductRelatedSections productId={product.id} categoryId={product.categoryId} />
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
