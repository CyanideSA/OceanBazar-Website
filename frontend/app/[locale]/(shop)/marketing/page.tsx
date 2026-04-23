import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  ShieldCheck, Truck, Zap, Building2, MapPin, CreditCard,
  Star, Package, HeadphonesIcon, RefreshCcw, BadgePercent,
  CheckCircle2, Globe, Lock, Clock, TrendingUp,
} from 'lucide-react';

export default async function MarketingPage() {
  const locale = await getLocale();
  const t = await getTranslations('marketing');

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="mb-12 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/90 to-primary px-8 py-14 text-primary-foreground shadow-soft md:px-14">
        <p className="text-xs font-bold uppercase tracking-widest opacity-75">OceanBazar Platform</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
          {t('heroTitle')}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed opacity-90 md:text-base">{t('heroSub')}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/${locale}/products`}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-primary shadow transition-all hover:brightness-105"
          >
            {t('shopNow')}
          </Link>
          <Link
            href={`/${locale}/wholesale`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/15 px-6 py-3 text-sm font-bold backdrop-blur-sm transition-all hover:bg-white/25"
          >
            {t('wholesaleHub')}
          </Link>
        </div>
      </div>

      {/* ── Why OceanBazar ────────────────────────────────────────────── */}
      <section className="mb-12">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">{t('whyTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('whySub')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {([
            { icon: Globe,        color: 'text-primary',                           bg: 'bg-primary/10',     titleKey: 'feat1Title' as const, bodyKey: 'feat1Body' as const },
            { icon: BadgePercent, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', titleKey: 'feat2Title' as const, bodyKey: 'feat2Body' as const },
            { icon: ShieldCheck,  color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-500/10',    titleKey: 'feat3Title' as const, bodyKey: 'feat3Body' as const },
            { icon: Star,         color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10',   titleKey: 'feat4Title' as const, bodyKey: 'feat4Body' as const },
          ]).map((item) => (
            <div
              key={item.titleKey}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:border-primary/20 hover:shadow-soft-md"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.bg}`}>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <p className="font-semibold text-foreground">{t(item.titleKey)}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{t(item.bodyKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bangladesh-Focused Logistics ─────────────────────────────── */}
      <section className="mb-12">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col justify-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
              <MapPin className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">{t('logisticsTitle')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('logisticsSub')}</p>
            <ul className="mt-5 space-y-3">
              {([
                { icon: Clock,      text: t('log1'), color: 'text-primary' },
                { icon: Truck,      text: t('log2'), color: 'text-emerald-600 dark:text-emerald-400' },
                { icon: Package,    text: t('log3'), color: 'text-amber-600 dark:text-amber-400' },
                { icon: RefreshCcw, text: t('log4'), color: 'text-blue-600 dark:text-blue-400' },
              ]).map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <item.icon className={`h-4 w-4 shrink-0 ${item.color}`} />
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: t('stat1Label'), sub: t('stat1Sub'), icon: MapPin,     color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
              { label: t('stat2Label'), sub: t('stat2Sub'), icon: Clock,      color: 'text-primary',                           bg: 'bg-primary/10' },
              { label: t('stat3Label'), sub: t('stat3Sub'), icon: Zap,        color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10' },
              { label: t('stat4Label'), sub: t('stat4Sub'), icon: RefreshCcw, color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-500/10' },
            ]).map((card, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5 shadow-soft">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.bg}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
                <p className="text-lg font-extrabold text-foreground">{card.label}</p>
                <p className="text-xs text-muted-foreground">{card.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Secure Payments ──────────────────────────────────────────── */}
      <section className="mb-12">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="grid gap-0 lg:grid-cols-2">
            <div className="border-b border-border p-8 lg:border-b-0 lg:border-r">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10">
                <Lock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">{t('paymentsTitle')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('paymentsSub')}</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {[
                  { label: 'bKash',      sub: 'Mobile banking', icon: CreditCard,  color: 'text-rose-600',                    bg: 'bg-rose-500/10' },
                  { label: 'Nagad',      sub: 'Mobile banking', icon: CreditCard,  color: 'text-orange-600',                  bg: 'bg-orange-500/10' },
                  { label: 'Rocket',     sub: 'DBBL mobile',    icon: CreditCard,  color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10' },
                  { label: 'SSLCommerz', sub: 'Cards & more',   icon: ShieldCheck, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
                ].map((gw) => (
                  <div key={gw.label} className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${gw.bg}`}>
                      <gw.icon className={`h-4 w-4 ${gw.color}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{gw.label}</p>
                      <p className="text-xs text-muted-foreground">{gw.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
                <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-foreground">{t('protectionTitle')}</h3>
              <ul className="mt-4 space-y-3">
                {([1,2,3,4,5,6] as const).map((n) => (
                  <li key={n} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    {t(`protect${n}` as Parameters<typeof t>[0])}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Fast Delivery ────────────────────────────────────────────── */}
      <section className="mb-12">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-muted/30 to-muted/10 p-8 shadow-soft md:p-10">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Truck className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">{t('deliveryTitle')}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{t('deliverySub')}</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {([
              { icon: Zap,           titleKey: 'del1Title' as const, bodyKey: 'del1Body' as const, color: 'text-primary',                           bg: 'bg-primary/10' },
              { icon: Clock,         titleKey: 'del2Title' as const, bodyKey: 'del2Body' as const, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
              { icon: HeadphonesIcon,titleKey: 'del3Title' as const, bodyKey: 'del3Body' as const, color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10' },
            ]).map((item) => (
              <div key={item.titleKey} className="rounded-xl border border-border bg-card p-5 shadow-soft">
                <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${item.bg}`}>
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <p className="font-semibold text-foreground">{t(item.titleKey)}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(item.bodyKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Wholesale Opportunities ──────────────────────────────────── */}
      <section className="mb-12">
        <div className="overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-500/5 shadow-soft">
          <div className="grid gap-0 lg:grid-cols-2">
            <div className="p-8 md:p-10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20">
                <Building2 className="h-6 w-6 text-amber-700 dark:text-amber-400" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">{t('wholesaleTitle')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('wholesaleSub')}</p>
              <ul className="mt-5 space-y-3">
                {([1,2,3,4,5] as const).map((n) => (
                  <li key={n} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    {t(`wPoint${n}` as Parameters<typeof t>[0])}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={`/${locale}/wholesale`}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-6 py-3 text-sm font-bold text-white shadow transition-all hover:brightness-110"
                >
                  <Building2 className="h-4 w-4" />
                  {t('applyWholesale')}
                </Link>
                <Link
                  href={`/${locale}/products`}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  {t('browseProducts')}
                </Link>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-4 border-t border-amber-500/20 p-8 lg:border-l lg:border-t-0 md:p-10">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">{t('whoTitle')}</p>
              {([
                { icon: Package,    titleKey: 'who1Title' as const, bodyKey: 'who1Body' as const },
                { icon: TrendingUp, titleKey: 'who2Title' as const, bodyKey: 'who2Body' as const },
                { icon: Building2,  titleKey: 'who3Title' as const, bodyKey: 'who3Body' as const },
              ]).map((item) => (
                <div key={item.titleKey} className="flex gap-4 rounded-xl border border-amber-500/20 bg-background/60 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
                    <item.icon className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{t(item.titleKey)}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{t(item.bodyKey)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section>
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 px-6 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Star className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">{t('ctaTitle')}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{t('ctaSub')}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href={`/${locale}/products`}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 font-bold text-primary-foreground shadow-soft transition-all hover:brightness-110 hover:shadow-glow-primary"
            >
              {t('browseProducts')}
            </Link>
            <Link
              href={`/${locale}/wholesale`}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-8 py-3 font-semibold text-foreground transition-colors hover:bg-muted"
            >
              {t('wholesaleHub')}
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
