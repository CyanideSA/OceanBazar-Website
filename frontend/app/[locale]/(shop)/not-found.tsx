'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Waves } from 'lucide-react';

export default function NotFound() {
  const locale = useLocale();

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-6">
        <span className="text-[8rem] leading-none select-none">🌊</span>
        <span className="absolute -bottom-2 -right-4 text-5xl">🔍</span>
      </div>

      <h1 className="mb-2 text-8xl font-black tracking-tight text-primary">404</h1>
      <h2 className="mb-3 text-2xl font-bold text-foreground">Page Not Found</h2>
      <p className="mb-8 max-w-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist, was removed, or the link is broken.
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href={`/${locale}`}
          className="rounded-xl bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-md transition-all hover:brightness-110 hover:shadow-lg"
        >
          🏠 Back to Home
        </Link>
        <Link
          href={`/${locale}/products`}
          className="rounded-xl border border-border bg-card px-6 py-3 font-semibold text-foreground transition-colors hover:bg-muted"
        >
          🛍️ Browse Products
        </Link>
      </div>

      <div className="mt-12 flex items-center gap-2 text-sm text-muted-foreground">
        <Waves className="h-4 w-4 text-primary" />
        <span>OceanBazar — Bangladesh&apos;s Smart Shopping Platform</span>
      </div>
    </div>
  );
}
