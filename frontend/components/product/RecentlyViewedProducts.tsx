'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { getRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { getMediaUrl } from '@/lib/mediaUrl';
import { Clock } from 'lucide-react';

export default function RecentlyViewedProducts({ excludeId }: { excludeId?: string }) {
  const locale = useLocale();
  const [items, setItems] = useState<Array<{ id: string; title: string; image: string | null; price: number | null }>>([]);

  useEffect(() => {
    const all = getRecentlyViewed().filter((p) => p.id !== excludeId);
    setItems(all.slice(0, 6));
  }, [excludeId]);

  if (items.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
        <Clock className="h-5 w-5 text-primary" />
        Recently Viewed
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/${locale}/product/${item.id}`}
            className="group flex flex-col rounded-xl border border-border bg-card p-2 transition-all hover:border-primary/40 hover:shadow-md"
          >
            <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
              {item.image ? (
                <Image
                  src={getMediaUrl(item.image)}
                  alt={item.title}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center text-2xl text-muted-foreground">📦</div>
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-xs font-medium text-foreground">{item.title}</p>
            {item.price != null && (
              <p className="mt-1 text-xs font-bold text-primary">৳{item.price.toLocaleString()}</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
