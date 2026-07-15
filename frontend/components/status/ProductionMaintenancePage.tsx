'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Mail, Facebook, Instagram, Linkedin, Youtube } from 'lucide-react';
import Logo from '@/components/shared/Logo';
import OceanVideoBackground from '@/components/shared/OceanVideoBackground';
import MaintenanceLanguageSwitch from '@/components/status/MaintenanceLanguageSwitch';

const SOCIAL = [
  { icon: Facebook, label: 'Facebook', href: '#' },
  { icon: Instagram, label: 'Instagram', href: '#' },
  { icon: Linkedin, label: 'LinkedIn', href: '#' },
  { icon: Youtube, label: 'YouTube', href: '#' },
] as const;

export default function ProductionMaintenancePage() {
  const t = useTranslations('status.maintenance');
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => (p >= 92 ? 12 : p + Math.random() * 4));
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <OceanVideoBackground />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-15%,rgba(56,189,248,0.18),transparent)]"
      />
      <div className="pointer-events-none absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <MaintenanceLanguageSwitch />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-5 py-16 sm:px-8">
        <div className="mb-10 drop-shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
          <Logo width={220} height={103} priority interaction="none" />
        </div>
        <div className="w-full rounded-2xl border border-white/15 bg-black/35 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-12">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.35em] text-sky-300/95">
            {t('badge')}
          </p>
          <h1 className="mt-4 text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {t('headline')}
          </h1>
          <p className="mt-4 text-center text-base leading-relaxed text-slate-100 sm:text-lg">{t('message')}</p>
          <p className="mt-4 text-center text-sm leading-relaxed text-slate-300/95">{t('hint')}</p>
          <div className="mx-auto mt-10 max-w-md">
            <div className="mb-2 flex justify-between text-xs text-slate-300">
              <span>{t('progressLabel')}</span>
              <span>{t('launchEstimate')}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 transition-all ease-out shadow-[0_0_20px_rgba(56,189,248,0.5)]"
                style={{ width: `${Math.min(progress, 100)}%`, transitionDuration: '2200ms' }}
              />
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center gap-2 border-t border-white/15 pt-8">
            <p className="text-sm text-slate-300">{t('contactLabel')}</p>
            <a
              href="mailto:oceanbazar@outlook.com"
              className="inline-flex items-center gap-2 text-sm font-medium text-sky-200 transition hover:text-white"
            >
              <Mail className="h-4 w-4" /> oceanbazar@outlook.com
            </a>
          </div>
          <div className="mt-8 flex justify-center gap-3">
            {SOCIAL.map(({ icon: Icon, label, href }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-slate-200 transition hover:border-sky-400/50 hover:bg-sky-500/20 hover:text-white"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
        <p className="mt-10 text-center text-xs text-slate-400/90">
          © {new Date().getFullYear()} OceanBazar · {t('domain')} · {t('rights')}
        </p>
      </div>
    </div>
  );
}
