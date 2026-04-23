'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Globe } from 'lucide-react';

export default function LanguageToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('common');

  const toggle = () => {
    const newLocale = locale === 'en' ? 'bn' : 'en';
    // Replace current locale prefix with new one
    const segments = pathname.split('/');
    segments[1] = newLocale;
    const newPath = segments.join('/');
    router.push(newPath);
    localStorage.setItem('ob_locale', newLocale);
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary"
      title={t('language')}
    >
      <Globe className="h-4 w-4" />
      <span>{locale === 'en' ? 'বাংলা' : 'English'}</span>
    </button>
  );
}
