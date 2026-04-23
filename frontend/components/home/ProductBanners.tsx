'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const BANNERS = [
  { id: '1', gradient: 'from-rose-500 to-orange-400',   href: 'featured' },
  { id: '2', gradient: 'from-violet-600 to-indigo-500', href: 'top-trending' },
  { id: '3', gradient: 'from-emerald-500 to-teal-600',  href: 'latest' },
];

export default function ProductBanners() {
  const locale = useLocale();
  const t = useTranslations('home.banners');

  return (
    <section className="section-padding">
      <div className="container-tight">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-5">
          {BANNERS.map((b, i) => (
            <Link
              key={b.id}
              href={`/${locale}/products/${b.href}`}
              className={cn(
                'group relative isolate overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white sm:p-7',
                'shadow-soft-md transition-all duration-300 hover:shadow-soft-lg hover:-translate-y-0.5',
                b.gradient,
              )}
            >
              <div className="relative z-10 flex items-center justify-between gap-3 sm:block">
                <div className="min-w-0">
                  <p className="text-xs font-medium opacity-90 sm:text-sm">{t(`line${i + 1}a`)}</p>
                  <p className="mt-1 truncate text-lg font-extrabold tracking-tight sm:mt-1.5 sm:text-2xl">{t(`line${i + 1}b`)}</p>
                </div>
                <span className="mt-0 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold backdrop-blur-sm transition-colors group-hover:bg-white/30 sm:mt-4">
                  {t('cta')}
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 sm:h-28 sm:w-28" />
              <div className="absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-white/5 sm:h-20 sm:w-20" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
