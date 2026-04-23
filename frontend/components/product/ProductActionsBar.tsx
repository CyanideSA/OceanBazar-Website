'use client';

import { Heart, GitCompare, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useWishlistStore } from '@/stores/wishlistStore';
import { useCompareStore } from '@/stores/compareStore';
import { cn } from '@/lib/utils';

interface Props {
  productId: string;
  title: string;
}

export default function ProductActionsBar({ productId, title }: Props) {
  const t = useTranslations('productDetail');
  const toggleWish = useWishlistStore((s) => s.toggle);
  const wishHas = useWishlistStore((s) => s.has(productId));
  const addCompare = useCompareStore((s) => s.add);
  const compareHas = useCompareStore((s) => s.has(productId));

  async function share() {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert(t('linkCopied'));
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => toggleWish(productId)}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
          wishHas ? 'border-red-500/50 bg-red-500/10 text-red-600' : 'border-border bg-background hover:border-primary/40'
        )}
      >
        <Heart className={cn('h-4 w-4', wishHas && 'fill-current')} />
        {t('wishlist')}
      </button>
      <button
        type="button"
        onClick={() => {
          const ok = addCompare(productId);
          if (!ok) alert(t('compareFull'));
        }}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
          compareHas ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:border-primary/40'
        )}
      >
        <GitCompare className="h-4 w-4" />
        {t('compare')}
      </button>
      <button
        type="button"
        onClick={share}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium hover:border-primary/40"
      >
        <Share2 className="h-4 w-4" />
        {t('share')}
      </button>
    </div>
  );
}
