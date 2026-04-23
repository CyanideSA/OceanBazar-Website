'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Globe, BadgePercent, ShieldCheck, HeadphonesIcon, Lock, Settings2,
  Building2, Users, MapPin, Clock, CheckCircle2, Send,
} from 'lucide-react';

const FEATURES = [
  { icon: Globe,           color: 'text-primary',                           bg: 'bg-primary/10',     titleKey: 'feat1Title', bodyKey: 'feat1Body' },
  { icon: BadgePercent,    color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', titleKey: 'feat2Title', bodyKey: 'feat2Body' },
  { icon: ShieldCheck,     color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-500/10',    titleKey: 'feat3Title', bodyKey: 'feat3Body' },
  { icon: HeadphonesIcon,  color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10',   titleKey: 'feat4Title', bodyKey: 'feat4Body' },
  { icon: Lock,            color: 'text-violet-600 dark:text-violet-400',   bg: 'bg-violet-500/10',  titleKey: 'feat5Title', bodyKey: 'feat5Body' },
  { icon: Settings2,       color: 'text-rose-600 dark:text-rose-400',       bg: 'bg-rose-500/10',    titleKey: 'feat6Title', bodyKey: 'feat6Body' },
] as const;

const STATS = [
  { key: 'stat1', icon: Users,  color: 'text-primary',                           bg: 'bg-primary/10' },
  { key: 'stat2', icon: MapPin, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  { key: 'stat3', icon: Clock,  color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10' },
  { key: 'stat4', icon: CheckCircle2, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
] as const;

const BIZ_TYPES = ['retailer', 'corporate', 'brand', 'wholesale', 'other'] as const;

const inputCls =
  'w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow';

export default function BusinessInquiriesPage() {
  const t = useTranslations('business');
  const [sent, setSent] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">

      {/* ── Hero ── */}
      <div className="mb-12 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/90 to-primary px-8 py-14 text-primary-foreground shadow-soft md:px-14">
        <p className="text-xs font-bold uppercase tracking-widest opacity-75">{t('heroTag')}</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
          {t('title')}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed opacity-90 md:text-base">{t('subtitle')}</p>
      </div>

      {/* ── Why Partner ── */}
      <section className="mb-12">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">{t('whyTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('whySub')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.titleKey}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft transition-all hover:border-primary/20 hover:shadow-soft-md"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${f.bg}`}>
                <f.icon className={`h-5 w-5 ${f.color}`} />
              </div>
              <p className="font-semibold text-foreground">{t(f.titleKey)}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{t(f.bodyKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="mb-12">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.key} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5 shadow-soft">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.bg}`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className="text-xl font-extrabold text-foreground">{t(s.key)}</p>
              <p className="text-xs text-muted-foreground">{t(`${s.key}Label`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA + Form ── */}
      <section>
        <div className="overflow-hidden rounded-2xl border border-primary/20 bg-primary/5 shadow-soft">
          <div className="grid gap-0 lg:grid-cols-2">

            {/* Left — CTA info */}
            <div className="flex flex-col justify-center p-8 md:p-10">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">{t('ctaTitle')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('ctaSub')}</p>
              <ul className="mt-6 space-y-3">
                {(['feat1Title', 'feat2Title', 'feat3Title', 'feat4Title'] as const).map((k) => (
                  <li key={k} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    {t(k)}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — Form */}
            <div className="border-t border-primary/10 p-8 lg:border-l lg:border-t-0 md:p-10">
              <h3 className="mb-5 text-lg font-bold text-foreground">{t('formTitle')}</h3>

              {sent ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                  <p className="font-semibold text-foreground">{t('success')}</p>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="space-y-3.5">
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">{t('name')}</label>
                      <input required name="name" className={inputCls} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">{t('email')}</label>
                      <input required type="email" name="email" className={inputCls} />
                    </div>
                  </div>
                  <div className="grid gap-3.5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">{t('company')}</label>
                      <input name="company" className={inputCls} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-muted-foreground">{t('phone')}</label>
                      <input name="phone" type="tel" className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">{t('businessType')}</label>
                    <select name="businessType" className={inputCls}>
                      {BIZ_TYPES.map((bt) => (
                        <option key={bt} value={bt}>{t(`businessTypes.${bt}`)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">{t('message')}</label>
                    <textarea
                      required
                      name="message"
                      rows={4}
                      placeholder={t('messagePlaceholder')}
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground shadow-soft transition-all hover:brightness-110 hover:shadow-glow-primary active:scale-[0.98]"
                  >
                    <Send className="h-4 w-4" />
                    {t('submit')}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
