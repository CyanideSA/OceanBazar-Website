'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const BRANDS = [
  { id: 'samsung', name: 'Samsung', abbr: 'Sa', color: 'bg-blue-600' },
  { id: 'apple',   name: 'Apple',   abbr: 'Ap', color: 'bg-zinc-800 dark:bg-zinc-700' },
  { id: 'xiaomi',  name: 'Xiaomi',  abbr: 'Xi', color: 'bg-orange-500' },
  { id: 'sony',    name: 'Sony',    abbr: 'So', color: 'bg-slate-700' },
  { id: 'lg',      name: 'LG',      abbr: 'LG', color: 'bg-red-600' },
  { id: 'philips', name: 'Philips', abbr: 'Ph', color: 'bg-blue-800' },
  { id: 'walton',  name: 'Walton',  abbr: 'Wa', color: 'bg-emerald-600' },
  { id: 'penguin', name: 'Penguin', abbr: 'Pe', color: 'bg-amber-600' },
];

export default function TopBrandsRow() {
  const locale = useLocale();
  const t = useTranslations('home.brands');

  return (
    <section className="section-padding border-y border-border/40 bg-muted/10">
      <div className="container-tight">
        <div className="mb-4 flex items-center justify-between gap-2 sm:mb-6">
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-2xl">{t('title')}</h2>
            <div className="mt-1 h-0.5 w-10 rounded-full bg-primary sm:mt-1.5 sm:w-12" />
          </div>
          <Link
            href={`/${locale}/products`}
            className="group inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 hover:text-primary/80"
          >
            {t('viewAll')}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        {/* Mobile: horizontal scroll row; md+: 8-col grid */}
        <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-8 md:gap-4 md:overflow-visible md:px-0 md:pb-0">
          {BRANDS.map((b) => (
            <Link
              key={b.id}
              href={`/${locale}/products?search=${encodeURIComponent(b.name)}`}
              className={cn(
                'group flex w-[72px] shrink-0 flex-col items-center rounded-xl border border-border/40 bg-card p-2.5 text-center md:w-auto md:p-3',
                'shadow-soft transition-all duration-200 hover:border-primary/30 hover:shadow-soft-md hover:-translate-y-0.5',
              )}
            >
              <div
                className={cn(
                  'mb-2 flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white shadow-soft md:h-12 md:w-12 md:text-sm',
                  b.color,
                )}
              >
                {b.abbr}
              </div>
              <span className="line-clamp-1 w-full text-xs font-medium text-foreground transition-colors group-hover:text-primary">
                {b.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
