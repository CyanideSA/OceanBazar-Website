'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  variant?: 'default' | 'footer';
};

const LANGS = [
  { code: 'bn', label: 'বাংলা', flag: '🇧🇩' },
  { code: 'en', label: 'English', flag: 'EN' },
] as const;

export default function LanguageSelect({ className, variant = 'default' }: Props) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const onChange = (next: string) => {
    if (next === locale) return;
    const segments = pathname.split('/');
    segments[1] = next;
    router.push(segments.join('/'));
    try {
      localStorage.setItem('ob_locale', next);
      document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000;`;
    } catch {
      /* ignore */
    }
  };

  /* Footer variant — keeps the dropdown for compactness */
  if (variant === 'footer') {
    return (
      <label className={cn('inline-flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <Globe className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        <select
          value={locale}
          onChange={(e) => onChange(e.target.value)}
          className="cursor-pointer rounded-md border border-border/60 bg-card py-1.5 pl-2 pr-8 text-sm font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Language"
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
          ))}
        </select>
      </label>
    );
  }

  /* Default variant — pill toggle */
  return (
    <div className={cn('inline-flex items-center rounded-lg border border-border/60 bg-muted/30 p-0.5', className)} role="radiogroup" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          role="radio"
          aria-checked={locale === l.code}
          onClick={() => onChange(l.code)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-all',
            locale === l.code
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <span className="text-xs font-bold leading-none">{l.flag}</span>
          <span>{l.label}</span>
        </button>
      ))}
    </div>
  );
}
