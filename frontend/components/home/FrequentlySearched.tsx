'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';

const DEFAULT_TERMS_EN = [
  'Samsung phone', 'laptop', 'headphones', 'smart watch', 'power bank',
  'kitchen', 'fashion', 'shoes', 'baby products', 'LED TV',
];

const DEFAULT_TERMS_BN = [
  'স্যামসাং ফোন', 'ল্যাপটপ', 'হেডফোন', 'স্মার্ট ওয়াচ', 'পাওয়ার ব্যাংক',
  'রান্নাঘর', 'ফ্যাশন', 'জুতা', 'শিশু পণ্য', 'LED টিভি',
];

export default function FrequentlySearched() {
  const locale = useLocale();
  const t = useTranslations('home.frequent');
  const base = locale === 'bn' ? DEFAULT_TERMS_BN : DEFAULT_TERMS_EN;
  const [extra, setExtra] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('ob_recent_searches');
      if (raw) setExtra(JSON.parse(raw).slice(0, 5));
    } catch { /* ignore */ }
  }, []);

  const terms = useMemo(() => {
    const merged = [...new Set([...extra, ...base])];
    return merged.slice(0, 10);
  }, [base, extra]);

  return (
    <section className="border-b border-border/40 bg-muted/20 py-4 sm:py-5">
      <div className="container-tight">
        <div className="mb-2.5 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t('title')}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {terms.map((term) => (
            <Link
              key={term}
              href={`/${locale}/products?search=${encodeURIComponent(term)}`}
              className="inline-flex min-h-[36px] items-center rounded-full border border-border/60 bg-background px-3 py-1.5 text-sm text-foreground shadow-soft transition-all hover:border-primary/40 hover:text-primary hover:shadow-soft-md"
            >
              {term}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
