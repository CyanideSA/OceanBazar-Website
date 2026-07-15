'use client';

import { useLocale } from 'next-intl';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const LANGS = [
  { code: 'bn', label: 'বাংলা', flag: '🇧🇩' },
  { code: 'en', label: 'English', flag: 'EN' },
] as const;

/** Locale switch for maintenance (works on static S3 — navigates to /{locale}/maintenance). */
export default function MaintenanceLanguageSwitch({ className }: { className?: string }) {
  const locale = useLocale();

  const onChange = (next: string) => {
    if (next === locale) return;
    try {
      localStorage.setItem('ob_locale', next);
      document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000;`;
    } catch {
      /* ignore */
    }
    // Static S3 + CloudFront: use explicit .html keys (SPA 404 fallback would serve wrong locale).
    window.location.assign(`/${next}/maintenance.html`);
  };

  return (
    <label
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-2 text-sm text-white shadow-lg backdrop-blur-md',
        className,
      )}
    >
      <Globe className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
      <select
        value={locale}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer bg-transparent font-medium text-white focus:outline-none"
        aria-label="Language"
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code} className="text-slate-900">
            {l.flag} {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
