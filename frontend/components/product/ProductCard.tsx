'use client';

import Link from 'next/link';
import { useState, memo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { ShoppingCart, Star } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import type { Product } from '@/types';
import { cartApi } from '@/lib/api';
import { useCartStore } from '@/stores/cartStore';
import { useAuthStore } from '@/stores/authStore';
import { calculatePrice } from '@/lib/pricing';
import { getMediaUrl } from '@/lib/mediaUrl';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';

interface Props {
  product: Product;
}

function ProductCard({ product }: Props) {
  const locale = useLocale();
  const tc = useTranslations('common');
  const tp = useTranslations('product');
  const { setCart, setOpen } = useCartStore();
  const { user } = useAuthStore();
  const { success, error: toastError } = useToast();
  const [imgError, setImgError] = useState(false);
  const userType = user?.userType ?? 'retail';

  const priceResult = calculatePrice(userType, product.pricing, 1, product.moq);
  const compareAt = product.pricing.retail?.compareAt;
  const hasDiscount = compareAt && compareAt > product.pricing.retail!.price;
  const discountPct = hasDiscount
    ? Math.round((1 - product.pricing.retail!.price / Number(compareAt)) * 100)
    : 0;

  const addMutation = useMutation({
    mutationFn: () => cartApi.add(product.id, 1).then((r) => r.data),
    onSuccess: (data) => {
      setCart(data);
      setOpen(true);
      success(tp('addedToCart'));
    },
    onError: () => toastError(tc('error')),
  });

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card text-card-foreground',
        'shadow-soft transition-all duration-300 content-visibility-auto',
        'hover:border-primary/20 hover:shadow-soft-lg hover:-translate-y-0.5',
      )}
    >
      {/* Image */}
      <Link href={`/${locale}/product/${product.id}`} className="relative aspect-square overflow-hidden bg-muted">
        {product.primaryImage && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getMediaUrl(product.primaryImage)}
            alt={product.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-108"
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground/20">
            <ShoppingCart className="h-10 w-10" />
          </div>
        )}

        {/* Badges */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {hasDiscount && (
            <span className="rounded-md bg-destructive px-1.5 py-0.5 text-2xs font-bold text-destructive-foreground shadow-sm">
              -{discountPct}%
            </span>
          )}
        </div>

        {/* Out of stock */}
        {product.stock === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
              {tc('outOfStock')}
            </span>
          </div>
        )}

        {/* Quick-add overlay */}
        <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <button
            onClick={(e) => { e.preventDefault(); addMutation.mutate(); }}
            disabled={product.stock === 0 || addMutation.isPending}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground',
              'transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-40',
            )}
          >
            <ShoppingCart className="h-4 w-4" />
            {tp('addToCart')}
          </button>
        </div>
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col p-2.5 sm:p-3.5">
        {/* Brand */}
        {product.brand && (
          <p className="mb-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            {product.brand}
          </p>
        )}

        {/* Title */}
        <Link href={`/${locale}/product/${product.id}`}>
          <h3 className="mb-2 line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors hover:text-primary">
            {product.title}
          </h3>
        </Link>

        {/* Rating */}
        {product.ratingAvg != null && (product.reviewCount ?? 0) > 0 && (
          <div className="mb-2 flex items-center gap-1">
            <Star className="h-3 w-3 fill-warning text-warning" />
            <span className="text-xs font-medium text-foreground">{Number(product.ratingAvg).toFixed(1)}</span>
            <span className="text-2xs text-muted-foreground">({product.reviewCount})</span>
          </div>
        )}

        {/* Price — pushed to bottom */}
        <div className="mt-auto flex items-end justify-between gap-2">
          <div>
            <span className="text-sm font-bold text-foreground sm:text-base">
              {tc('taka')}{priceResult.unitPrice.toLocaleString()}
            </span>
            {hasDiscount && (
              <span className="ml-1 text-2xs text-muted-foreground line-through sm:text-xs">
                {tc('taka')}{Number(compareAt).toLocaleString()}
              </span>
            )}
          </div>

          {/* Mobile add button */}
          <button
            onClick={(e) => { e.preventDefault(); addMutation.mutate(); }}
            disabled={product.stock === 0 || addMutation.isPending}
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground md:hidden',
              'shadow-soft transition-all hover:shadow-glow-primary active:scale-95 disabled:opacity-40',
            )}
          >
            <ShoppingCart className="h-4 w-4" />
          </button>
        </div>

        {product.moq > 1 && (
          <p className="mt-1.5 text-2xs font-semibold text-primary">{tp('moq')}: {product.moq}</p>
        )}
      </div>
    </div>
  );
}

export default memo(ProductCard);
