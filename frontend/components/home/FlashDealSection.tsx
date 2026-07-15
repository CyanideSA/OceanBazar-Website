'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import ProductCard from '@/components/product/ProductCard';
import { resolvePublicApiBase } from '@/lib/api';
import {
  FLASH_DEALS_ANCHOR,
  flashDealsPagePath,
  type FlashActivePayload,
  type FlashCampaign,
} from '@/lib/flashDeals';
import {
  FlashGlowShell,
  FlashSectionHeader,
  FlashShowMoreButton,
  LiveCountdownRow,
} from '@/components/flash-sale/FlashDealShared';

const GRID_SIZE = 12;
const MOBILE_LIMIT = 9;

function CampaignBlock({ campaign, locale }: { campaign: FlashCampaign; locale: string }) {
  const t = useTranslations('home.flashDeal');
  const { sale, products } = campaign;
  const preview = products.slice(0, GRID_SIZE);
  const pageHref = flashDealsPagePath(locale, sale.id);

  return (
    <FlashGlowShell sale={sale} className="mb-8 last:mb-0">
      <FlashSectionHeader sale={sale} title={t('title')} subtitle={t('clockTicking')} />
      <LiveCountdownRow endsAt={sale.ends_at} />

      <div className="grid grid-cols-3 gap-2 sm:hidden">
        {preview.slice(0, MOBILE_LIMIT).map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      <div className="mt-3 flex justify-center sm:hidden">
        <FlashShowMoreButton href={pageHref} className="px-4 py-1.5 text-xs" />
      </div>

      <div className="hidden grid-cols-6 gap-3 sm:grid">
        {preview.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      <div className="mt-6 hidden justify-center sm:flex">
        <FlashShowMoreButton href={pageHref} />
      </div>
    </FlashGlowShell>
  );
}

export default function FlashDealSection() {
  const locale = useLocale();
  const [campaigns, setCampaigns] = useState<FlashCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlash = useCallback(async () => {
    try {
      const base = resolvePublicApiBase();
      const res = await fetch(`${base}/api/flash-sales/active?lang=${locale}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as FlashActivePayload;
      const live = (data.campaigns ?? []).filter((c) => c.products?.length > 0);
      setCampaigns(live);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    fetchFlash();
    const id = setInterval(fetchFlash, 60_000);
    return () => clearInterval(id);
  }, [fetchFlash]);

  useEffect(() => {
    if (loading || campaigns.length === 0) return;
    if (typeof window !== 'undefined' && window.location.hash === `#${FLASH_DEALS_ANCHOR}`) {
      requestAnimationFrame(() => {
        document.getElementById(FLASH_DEALS_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [loading, campaigns.length]);

  if (!loading && campaigns.length === 0) return null;

  return (
    <section id={FLASH_DEALS_ANCHOR} className="section-padding content-visibility-auto scroll-mt-28">
      <div className="container-tight">
        {loading ? (
          <FlashGlowShell>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
              {Array.from({ length: GRID_SIZE }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted/60" />
              ))}
            </div>
          </FlashGlowShell>
        ) : (
          campaigns.map((campaign) => (
            <CampaignBlock key={campaign.sale.id} campaign={campaign} locale={locale} />
          ))
        )}
      </div>
    </section>
  );
}
