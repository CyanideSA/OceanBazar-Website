'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Truck, Shield, RotateCcw, Headphones, Award, Lock, Package, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { storefrontApi } from '@/lib/api';

const ICON_MAP: Record<string, typeof Shield> = {
  shield: Shield,
  truck: Truck,
  rotate: RotateCcw,
  headphones: Headphones,
  award: Award,
  lock: Lock,
  package: Package,
  check: CheckCircle2,
};

const STYLE_CYCLE = [
  { gradient: 'from-sky-500/15 to-cyan-600/5', iconColor: 'text-sky-700 dark:text-sky-300' },
  { gradient: 'from-emerald-500/15 to-teal-600/5', iconColor: 'text-emerald-700 dark:text-emerald-300' },
  { gradient: 'from-amber-500/15 to-orange-600/5', iconColor: 'text-amber-700 dark:text-amber-300' },
  { gradient: 'from-indigo-500/15 to-blue-600/5', iconColor: 'text-indigo-700 dark:text-indigo-300' },
] as const;

type TrustBadgeRow = {
  id: number;
  slug: string;
  nameEn: string;
  nameBn: string;
  icon?: string;
  description?: string;
  productCount?: number;
};

export default function TrustBadgeStrip() {
  const locale = useLocale();
  const { data } = useQuery({
    queryKey: ['trust-badges-public'],
    queryFn: () => storefrontApi.trustBadges().then((r) => r.data),
    staleTime: 2 * 60 * 1000,
  });

  const badges = (Array.isArray(data?.badges) ? data.badges : []) as TrustBadgeRow[];
  const visible = badges.filter((b) => (b.productCount ?? 0) > 0);

  // #region agent log
  if (typeof window !== 'undefined') {
    // fire-and-forget once per meaningful payload via effect would be better; keep light
  }
  // #endregion

  if (!visible.length) return null;

  return (
    <section className="border-y border-border/40 bg-gradient-to-b from-card/80 to-background" data-ob-trust="product-linked">
      <div className="container-tight py-6 sm:py-8">
        <div className="mb-4 text-center sm:mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/80">Trusted selection</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl">
            Shop by OceanBazar trust badge
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {visible.slice(0, 8).map((badge, idx) => {
            const iconKey = String(badge.icon || 'shield').toLowerCase();
            const Icon = ICON_MAP[iconKey] || Shield;
            const style = STYLE_CYCLE[idx % STYLE_CYCLE.length];
            const label = locale === 'bn' ? badge.nameBn || badge.nameEn : badge.nameEn;
            const href = `/${locale}/products?trustBadge=${encodeURIComponent(badge.slug)}`;
            const count = Number(badge.productCount) || 0;
            return (
              <Link
                key={badge.id || badge.slug}
                href={href}
                className="group rounded-2xl border border-border/50 bg-card/60 p-3.5 transition-all hover:border-primary/35 hover:bg-card hover:shadow-soft sm:p-4"
              >
                <div className="flex items-start gap-2.5">
                  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-soft', style.gradient)}>
                    <Icon className={cn('h-5 w-5', style.iconColor)} />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-sm font-semibold leading-tight text-foreground group-hover:text-primary">
                      {label}
                    </span>
                    {badge.description ? (
                      <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground line-clamp-2">
                        {badge.description}
                      </span>
                    ) : null}
                    <span className="mt-2 inline-block text-[11px] font-semibold text-primary/90">
                      {count} {count === 1 ? 'product' : 'products'}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
