'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Building2, TrendingDown, Shield, Truck, Package, Zap,
  BadgePercent, CheckCircle2, XCircle, ArrowRight, Star,
  BarChart3, HeadphonesIcon, RefreshCcw,
} from 'lucide-react';
import { customersApi, ticketsApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

type CustomerMeResponse = {
  user: { id: string; userType: 'retail' | 'wholesale'; name: string; email: string | null; phone: string | null };
  customer: { companyName: string | null; taxId: string | null; segment: string | null } | null;
};

export default function WholesalePage() {
  const locale = useLocale();
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');
  const tw = useTranslations('wholesale');
  const { user, isAuthenticated } = useAuthStore();

  const { data: meData } = useQuery({
    queryKey: ['customers-me'],
    queryFn: () => customersApi.me().then((r) => r.data as CustomerMeResponse),
    enabled: isAuthenticated,
  });

  const effectiveUserType = (meData?.user.userType ?? user?.userType ?? 'retail') as 'retail' | 'wholesale';

  const [companyName, setCompanyName] = useState(meData?.customer?.companyName ?? '');
  const [taxId, setTaxId] = useState(meData?.customer?.taxId ?? '');
  const [segment, setSegment] = useState(meData?.customer?.segment ?? '');
  const [contactPerson, setContactPerson] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [expectedMonthlyVolume, setExpectedMonthlyVolume] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const subject = useMemo(() => {
    const base = 'Wholesale access application';
    if (companyName.trim()) return `${base}: ${companyName.trim()}`;
    return base;
  }, [companyName]);

  const payloadMessage = useMemo(() => {
    return [
      'Wholesale Hub Application',
      '',
      `Company Name: ${companyName || '—'}`,
      `Business Type / Segment: ${segment || '—'}`,
      `Tax ID: ${taxId || '—'}`,
      `Contact Person: ${contactPerson || '—'}`,
      `Email: ${email || '—'}`,
      `Phone: ${phone || '—'}`,
      `Business Address: ${address || '—'}`,
      `Expected Monthly Volume: ${expectedMonthlyVolume || '—'}`,
      '',
      'Description:',
      description || '—',
    ].join('\n');
  }, [address, companyName, contactPerson, description, email, expectedMonthlyVolume, phone, segment, taxId]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      setError('');
      if (!isAuthenticated) throw new Error('Please login to apply.');
      if (!companyName.trim() || !contactPerson.trim() || (!email.trim() && !phone.trim()) || !description.trim()) {
        throw new Error('Please fill in all required fields.');
      }
      await customersApi.updateMe({
        companyName: companyName.trim(),
        taxId: taxId.trim() ? taxId.trim() : null,
        segment: segment.trim() ? segment.trim() : null,
      });
      await ticketsApi.create({ subject, category: 'other', priority: 'medium', message: payloadMessage });
    },
    onSuccess: () => { setSubmitted(true); },
    onError: (e: unknown) => {
      setError((e as { message?: string; response?: { data?: { error?: string } } }).response?.data?.error ?? (e as { message?: string }).message ?? tCommon('error'));
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">

      {/* ── Hero Banner ────────────────────────────────────────────── */}
      <div className="mb-10 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/90 to-primary px-8 py-10 text-primary-foreground shadow-soft md:px-12 md:py-14">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20">
            <Building2 className="h-8 w-8" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider opacity-80">OceanBazar</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-4xl">{tNav('wholesaleHub')}</h1>
            <p className="mt-2 max-w-xl text-sm opacity-90 md:text-base">{tw('heroSub')}</p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: TrendingDown, label: tw('stat1Label'), sub: tw('stat1Sub') },
            { icon: Zap,         label: tw('stat2Label'), sub: tw('stat2Sub') },
            { icon: Shield,      label: tw('stat3Label'), sub: tw('stat3Sub') },
            { icon: Truck,       label: tw('stat4Label'), sub: tw('stat4Sub') },
          ].map((item) => (
            <div key={item.label} className="flex items-start gap-3 rounded-xl bg-white/15 p-3 backdrop-blur-sm">
              <item.icon className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-xs font-bold">{item.label}</p>
                <p className="text-xs opacity-75">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>
        {!isAuthenticated && (
          <div className="mt-8">
            <Link
              href={`/${locale}/auth/login`}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-primary shadow transition-all hover:brightness-105"
            >
              {tw('becomeCta')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>

      {/* ── Benefits Grid ───────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-1 text-xl font-bold text-foreground">{tw('whyTitle')}</h2>
        <p className="mb-6 text-sm text-muted-foreground">{tw('whySub')}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {([
            { icon: TrendingDown,    color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', titleKey: 'benefit1Title' as const, bodyKey: 'benefit1Body' as const },
            { icon: Zap,            color: 'text-primary',                           bg: 'bg-primary/10',     titleKey: 'benefit2Title' as const, bodyKey: 'benefit2Body' as const },
            { icon: Package,        color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10',   titleKey: 'benefit3Title' as const, bodyKey: 'benefit3Body' as const },
            { icon: Shield,         color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-500/10',    titleKey: 'benefit4Title' as const, bodyKey: 'benefit4Body' as const },
            { icon: HeadphonesIcon, color: 'text-violet-600 dark:text-violet-400',   bg: 'bg-violet-500/10',  titleKey: 'benefit5Title' as const, bodyKey: 'benefit5Body' as const },
            { icon: RefreshCcw,     color: 'text-rose-600 dark:text-rose-400',       bg: 'bg-rose-500/10',    titleKey: 'benefit6Title' as const, bodyKey: 'benefit6Body' as const },
          ]).map((b) => (
            <div key={b.titleKey} className="flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:border-primary/20 hover:shadow-soft-md">
              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', b.bg)}>
                <b.icon className={cn('h-5 w-5', b.color)} />
              </div>
              <div>
                <p className="font-semibold text-foreground">{tw(b.titleKey)}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{tw(b.bodyKey)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing Tiers ───────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-1 text-xl font-bold text-foreground">{tw('pricingTitle')}</h2>
        <p className="mb-6 text-sm text-muted-foreground">{tw('pricingSub')}</p>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
            <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-5 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <BadgePercent className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-bold text-foreground">{tw('retailPricingTitle')}</p>
                <p className="text-xs text-muted-foreground">{tw('retailPricingSub')}</p>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">{tw('colQtyRange')}</th>
                  <th className="px-4 py-2 text-left font-medium">{tw('colDiscount')}</th>
                  <th className="px-4 py-2 text-right font-medium">{tw('colNote')}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { range: '1 unit', discount: '—', note: 'Base price' },
                  { range: 'Tier 1 qty', discount: '-5%', note: 'Volume discount' },
                  { range: 'Tier 2 qty', discount: '-10%', note: 'Volume discount' },
                  { range: 'Tier 3 qty', discount: '-15%', note: 'Best retail rate' },
                ].map((r, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="px-4 py-2.5 font-medium text-foreground">{r.range}</td>
                    <td className="px-4 py-2.5 font-semibold text-emerald-600 dark:text-emerald-400">{r.discount}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-hidden rounded-2xl border border-amber-500/40 bg-card shadow-soft">
            <div className="flex items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-5 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20">
                <BarChart3 className="h-4 w-4 text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-bold text-foreground">{tw('wholesalePricingTitle')}</p>
                <p className="text-xs text-muted-foreground">{tw('wholesalePricingSub')}</p>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">{tw('colQtyRange')}</th>
                  <th className="px-4 py-2 text-left font-medium">{tw('colDiscount')}</th>
                  <th className="px-4 py-2 text-right font-medium">{tw('colNote')}</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { range: 'MOQ (25+)', discount: '—', note: 'Wholesale base' },
                  { range: 'Tier 1 qty', discount: '-2%', note: 'Volume discount' },
                  { range: 'Tier 2 qty', discount: '-5%', note: 'Volume discount' },
                  { range: 'Tier 3 qty', discount: '-8%', note: 'Best wholesale rate' },
                ].map((r, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="px-4 py-2.5 font-medium text-foreground">{r.range}</td>
                    <td className="px-4 py-2.5 font-semibold text-amber-600 dark:text-amber-400">{r.discount}</td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Retail vs Wholesale Comparison ──────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-1 text-xl font-bold text-foreground">{tw('comparisonTitle')}</h2>
        <p className="mb-6 text-sm text-muted-foreground">{tw('comparisonSub')}</p>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-bold">{tw('colFeature')}</th>
                <th className="px-5 py-3 text-center font-bold">{tw('colRetail')}</th>
                <th className="px-5 py-3 text-center font-bold text-amber-700 dark:text-amber-400">{tw('colWholesale')}</th>
              </tr>
            </thead>
            <tbody>
              {([
                { featureKey: 'compRow1' as const, retail: true,                                wholesale: true },
                { featureKey: 'compRow2' as const, retail: tw('compRow2Retail'),                wholesale: tw('compRow2Wholesale') },
                { featureKey: 'compRow3' as const, retail: false,                               wholesale: true },
                { featureKey: 'compRow4' as const, retail: false,                               wholesale: true },
                { featureKey: 'compRow5' as const, retail: false,                               wholesale: true },
                { featureKey: 'compRow6' as const, retail: false,                               wholesale: true },
                { featureKey: 'compRow7' as const, retail: false,                               wholesale: true },
              ] as { featureKey: Parameters<typeof tw>[0]; retail: boolean | string; wholesale: boolean | string }[]).map((row, i) => (
                <tr key={i} className="border-t border-border/60 transition-colors hover:bg-muted/20">
                  <td className="px-5 py-3 font-medium text-foreground">{tw(row.featureKey)}</td>
                  <td className="px-5 py-3 text-center">
                    {typeof row.retail === 'boolean' ? (
                      row.retail ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-500" /> : <XCircle className="mx-auto h-4 w-4 text-muted-foreground/40" />
                    ) : (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">{row.retail}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {typeof row.wholesale === 'boolean' ? (
                      row.wholesale ? <CheckCircle2 className="mx-auto h-4 w-4 text-amber-500" /> : <XCircle className="mx-auto h-4 w-4 text-muted-foreground/40" />
                    ) : (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">{row.wholesale}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Prominent CTA ────────────────────────────────────────────── */}
      {(!isAuthenticated || effectiveUserType === 'retail') && !submitted && (
        <div className="mb-10 flex flex-col items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 px-6 py-10 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Star className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">{tw('readyTitle')}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{tw('readySub')}</p>
          <a href="#apply" className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 font-bold text-primary-foreground shadow-soft transition-all hover:brightness-110 hover:shadow-glow-primary">
            {tw('becomeCta')}
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      )}

      {/* ── Application / Status Section ─────────────────────────────── */}
      <div id="apply">
        <h2 className="mb-6 text-xl font-bold text-foreground">
          {submitted ? tw('applicationSubmitted') : effectiveUserType === 'wholesale' ? tw('wholesaleActive') : tw('applicationTitle')}
        </h2>

        {!isAuthenticated ? (
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">{tw('loginToApply')}</p>
            <Link href={`/${locale}/auth/login`} className="mt-4 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground">
              {tNav('login')}
            </Link>
          </div>
        ) : effectiveUserType === 'wholesale' ? (
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-sm font-semibold text-foreground">{tw('alreadyWholesale')}</p>
            <Link href={`/${locale}/products/top-trending`} className="mt-4 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground">
              {tw('shopTopTrending')}
            </Link>
          </div>
        ) : submitted ? (
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="text-sm font-semibold text-foreground">{tw('appSubmittedMsg')}</p>
            <p className="mt-2 text-sm text-muted-foreground">{tw('appSubmittedHint')}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href={`/${locale}/tickets`} className="rounded-xl border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground">
                {tw('viewTickets')}
              </Link>
              <Link href={`/${locale}/products`} className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
                {tw('continueShopping')}
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground">{tw('whatHappensNext')}</h3>
              <ul className="mt-3 space-y-3 text-sm text-muted-foreground">
                {([1, 2, 3, 4] as const).map((i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i}</span>
                    {tw(`step${i}` as Parameters<typeof tw>[0])}
                  </li>
                ))}
              </ul>
              <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
                {tw('approvalNote')}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground">{tw('formTitle')}</h3>
              {error && (
                <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
              )}
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">{tw('fieldCompanyName')} *</label>
                  <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">{tw('fieldSegment')}</label>
                    <input value={segment} onChange={(e) => setSegment(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">{tw('fieldTaxId')}</label>
                    <input value={taxId} onChange={(e) => setTaxId(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">{tw('fieldContact')} *</label>
                  <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">{tw('fieldEmail')}</label>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">{tw('fieldPhone')}</label>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">{tw('fieldAddress')}</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">{tw('fieldVolume')}</label>
                  <input value={expectedMonthlyVolume} onChange={(e) => setExpectedMonthlyVolume(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground">{tw('fieldDescription')} *</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="mt-1 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm" />
                </div>
                <button
                  type="button"
                  disabled={submitMutation.isPending}
                  onClick={() => submitMutation.mutate()}
                  className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
                >
                  {submitMutation.isPending ? tCommon('loading') : tw('submitApplication')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
