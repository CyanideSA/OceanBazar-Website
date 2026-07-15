'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Sparkles } from 'lucide-react';
import ProductCard from '@/components/product/ProductCard';
import { resolvePublicApiBase } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  flashDealsHomeAnchorPath,
  flashDealsPagePath,
  type FlashCampaign,
  type FlashPagePayload,
  type FlashSaleMeta,
} from '@/lib/flashDeals';
import {
  FlashGlowShell,
  FlashSectionHeader,
  LiveCountdownRow,
  UpcomingCountdownCard,
} from '@/components/flash-sale/FlashDealShared';

function CampaignPageBlock({ campaign }: { campaign: FlashCampaign }) {
  const locale = useLocale();
  const t = useTranslations('home.flashDeal');
  const { sale, products } = campaign;

  return (
    <FlashGlowShell sale={sale} className="mb-10">
      <FlashSectionHeader sale={sale} title={t('title')} subtitle={t('clockTicking')} />
      <LiveCountdownRow endsAt={sale.ends_at} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      <div className="mt-6 flex justify-center">
        <Link
          href={flashDealsHomeAnchorPath(locale)}
          className="text-sm font-semibold text-orange-600 hover:text-orange-500 dark:text-orange-300"
        >
          ← {t('backToHome')}
        </Link>
      </div>
    </FlashGlowShell>
  );
}

export default function FlashDealsPageClient() {
  const locale = useLocale();
  const t = useTranslations('flashDealsPage');
  const searchParams = useSearchParams();
  const saleFilter = searchParams.get('sale');
  const [payload, setPayload] = useState<FlashPagePayload | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPage = useCallback(async () => {
    try {
      const base = resolvePublicApiBase();
      const qs = new URLSearchParams({ lang: locale });
      if (saleFilter) qs.set('sale', saleFilter);
      const res = await fetch(`${base}/api/flash-sales/page?${qs}`, { cache: 'no-store' });
      if (!res.ok) return;
      setPayload(await res.json());
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, [locale, saleFilter]);

  useEffect(() => {
    fetchPage();
    const id = setInterval(fetchPage, 60_000);
    return () => clearInterval(id);
  }, [fetchPage]);

  const accent = payload?.campaigns[0]?.sale.banner_color
    || payload?.upcoming[0]?.banner_color
    || '#f97316';

  return (
    <div
      className="relative min-h-[70vh] overflow-hidden"
      style={{
        background: `radial-gradient(ellipse at top, ${accent}22 0%, transparent 55%), linear-gradient(180deg, ${accent}12 0%, hsl(var(--background)) 45%)`,
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/60 to-transparent shadow-[0_0_20px_rgba(249,115,22,0.5)]" />

      <div className="container-tight section-padding relative">
        {loading ? (
          <div className="mx-auto max-w-3xl animate-pulse rounded-2xl bg-muted/40 p-12" />
        ) : payload?.mode === 'live' ? (
          <>
            <div className="mx-auto mb-10 max-w-3xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-orange-500">{t('eyebrow')}</p>
              <h1 className="mt-3 text-3xl font-black text-foreground sm:text-4xl">
                🔥 {t('liveTitle')} 🔥
              </h1>
              <p className="mt-3 text-base text-muted-foreground sm:text-lg">{t('liveSubtitle')}</p>
            </div>
            {payload.campaigns.map((campaign) => (
              <CampaignPageBlock key={campaign.sale.id} campaign={campaign} />
            ))}
          </>
        ) : (
          <FlashGlowShell className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-orange-500/15 px-4 py-2 text-sm font-bold text-orange-600 dark:text-orange-200">
              <Sparkles className="h-4 w-4" />
              {t('welcomeEyebrow')}
            </div>
            <h1 className="text-2xl font-black leading-tight text-foreground sm:text-4xl">
              {t('welcomeTitle')}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              {t('welcomeBody')}
            </p>

            {payload?.mode === 'upcoming' && payload.upcoming.length > 0 ? (
              <div className="mt-10 space-y-4 text-left">
                <p className="text-center text-sm font-bold uppercase tracking-widest text-orange-500">
                  ⏱ {t('upcomingHeading')}
                </p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {payload.upcoming.map((sale: FlashSaleMeta) => (
                    <UpcomingCountdownCard key={sale.id} sale={sale} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-10 rounded-2xl border border-dashed border-orange-400/30 bg-orange-500/5 px-6 py-10">
                <p className="text-4xl">🌊✨🛍️</p>
                <p className="mt-4 text-lg font-bold text-foreground">{t('comingSoonTitle')}</p>
                <p className="mt-2 text-muted-foreground">{t('comingSoonBody')}</p>
              </div>
            )}

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link
                href={`/${locale}/products`}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 px-6 py-3 text-sm font-bold text-white shadow-[0_0_24px_rgba(249,115,22,0.45)]',
                )}
              >
                {t('browseStore')}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={`/${locale}`}
                className="inline-flex items-center gap-2 rounded-xl border border-orange-400/40 px-6 py-3 text-sm font-semibold text-orange-700 dark:text-orange-200"
              >
                {t('backHome')}
              </Link>
            </div>
          </FlashGlowShell>
        )}
      </div>
    </div>
  );
}
