import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import {
  MessageSquare, RefreshCcw, ShieldCheck, FileText,
  Clock, CheckCircle2, ChevronRight,
  Package, CreditCard, Truck, AlertCircle, Star,
} from 'lucide-react';

export default async function SupportPage() {
  const locale = await getLocale();
  const t = await getTranslations('support');

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="mb-10 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/90 to-primary px-8 py-10 text-primary-foreground shadow-soft md:px-12">
        <p className="text-xs font-bold uppercase tracking-widest opacity-75">OceanBazar</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">{t('title')}</h1>
        <p className="mt-2 max-w-lg text-sm opacity-90">{t('subtitle')}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={`/${locale}/tickets`}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-primary shadow transition-all hover:brightness-105"
          >
            <MessageSquare className="h-4 w-4" />
            {t('openTicket')}
          </Link>
          <Link
            href={`/${locale}/returns`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/15 px-5 py-2.5 text-sm font-bold backdrop-blur-sm transition-all hover:bg-white/25"
          >
            <RefreshCcw className="h-4 w-4" />
            {t('startReturn')}
          </Link>
        </div>
      </div>

      {/* ── Quick Links ───────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-foreground">{t('helpTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {([
            { icon: Package,     color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-500/10',   titleKey: 'orderIssues',      subKey: 'orderIssuesSub',      href: `/${locale}/tickets` },
            { icon: RefreshCcw,  color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', titleKey: 'returnsRefunds',   subKey: 'returnsRefundsSub',   href: `/${locale}/returns` },
            { icon: CreditCard,  color: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-500/10',    titleKey: 'paymentProblems',  subKey: 'paymentProblemsSub', href: `/${locale}/tickets` },
            { icon: Truck,       color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10',  titleKey: 'deliveryTracking', subKey: 'deliveryTrackingSub',href: `/${locale}/orders` },
            { icon: Star,        color: 'text-rose-600 dark:text-rose-400',     bg: 'bg-rose-500/10',    titleKey: 'accountPoints',    subKey: 'accountPointsSub',    href: `/${locale}/account` },
            { icon: ShieldCheck, color: 'text-primary',                         bg: 'bg-primary/10',     titleKey: 'warrantyClaims',   subKey: 'warrantyClaimsSub',   href: `/${locale}/tickets` },
          ] as const).map((item) => (
            <Link
              key={item.titleKey}
              href={item.href}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:border-primary/20 hover:shadow-soft-md"
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.bg}`}>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{t(item.titleKey)}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t(item.subKey)}</p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </section>

      {/* ── Dispute & Return Process ──────────────────────────────────── */}
      <section className="mb-10">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Dispute flow */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <AlertCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">{t('disputeProcess')}</h3>
                <p className="text-xs text-muted-foreground">{t('disputeProcessSub')}</p>
              </div>
            </div>
            <ol className="space-y-3">
              {([1,2,3,4] as const).map((step) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t(`disputeStep${step}Title` as Parameters<typeof t>[0])}</p>
                    <p className="text-xs text-muted-foreground">{t(`disputeStep${step}Sub` as Parameters<typeof t>[0])}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link
              href={`/${locale}/tickets`}
              className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground"
            >
              <MessageSquare className="h-4 w-4" />
              {t('openDisputeTicket')}
            </Link>
          </div>

          {/* Return flow */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                <RefreshCcw className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">{t('returnProcess')}</h3>
                <p className="text-xs text-muted-foreground">{t('returnProcessSub')}</p>
              </div>
            </div>
            <ol className="space-y-3">
              {([1,2,3,4] as const).map((step) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t(`returnStep${step}Title` as Parameters<typeof t>[0])}</p>
                    <p className="text-xs text-muted-foreground">{t(`returnStep${step}Sub` as Parameters<typeof t>[0])}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link
              href={`/${locale}/returns`}
              className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-sm font-bold text-emerald-700 dark:text-emerald-400"
            >
              <RefreshCcw className="h-4 w-4" />
              {t('startReturnRequest')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Timelines ─────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-foreground">{t('timelinesTitle')}</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-bold">{t('colRequestType')}</th>
                <th className="px-5 py-3 text-left font-bold">{t('colInitialResponse')}</th>
                <th className="px-5 py-3 text-left font-bold">{t('colResolution')}</th>
              </tr>
            </thead>
            <tbody>
              {([1,2,3,4,5,6,7] as const).map((n) => (
                <tr key={n} className="border-t border-border/60 transition-colors hover:bg-muted/20">
                  <td className="px-5 py-3 font-medium text-foreground">{t(`row${n}Type` as Parameters<typeof t>[0])}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3 text-primary" />
                      {t(`row${n}Response` as Parameters<typeof t>[0])}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      {t(`row${n}Resolution` as Parameters<typeof t>[0])}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-foreground">{t('faqTitle')}</h2>
        <div className="space-y-3">
          {([1,2,3,4,5,6,7,8] as const).map((n) => (
            <div key={n} className="rounded-xl border border-border bg-card p-5 shadow-soft">
              <p className="font-semibold text-foreground">{t(`faq${n}q` as Parameters<typeof t>[0])}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`faq${n}a` as Parameters<typeof t>[0])}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Contact ───────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-foreground">{t('stillNeedHelp')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href={`/${locale}/tickets`}
            className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:border-primary/20 hover:shadow-soft-md"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{t('supportTicketsTitle')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('supportTicketsDesc')}</p>
              <p className="mt-2 text-xs font-semibold text-primary">{t('openTicketCta')}</p>
            </div>
          </Link>
          <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{t('policyDocsTitle')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('policyDocsDesc')}</p>
              <Link href={`/${locale}/policies/returns`} className="mt-2 inline-block text-xs font-semibold text-primary">
                {t('readPoliciesCta')}
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
