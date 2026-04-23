'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, Package, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { storefrontApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface HeroSlide {
  imageUrl: string;
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaLink?: string;
}

export default function HeroSection() {
  const t = useTranslations('home.hero');
  const locale = useLocale();
  const [current, setCurrent] = useState(0);

  const { data: settings } = useQuery({
    queryKey: ['storefront-settings'],
    queryFn: () => storefrontApi.settings().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const slides: HeroSlide[] = settings?.heroSlides?.length ? settings.heroSlides : [];
  const rotationMs = settings?.defaultBannerRotationMs || 6000;
  const hasSlides = slides.length > 0;

  const next = useCallback(() => setCurrent((c) => (c + 1) % (slides.length || 1)), [slides.length]);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + (slides.length || 1)) % (slides.length || 1)), [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(next, rotationMs);
    return () => clearInterval(id);
  }, [slides.length, rotationMs, next]);

  /* ─── Carousel Hero (admin-configured slides) ─── */
  if (hasSlides) {
    const slide = slides[current];
    return (
      <section className="relative isolate overflow-hidden bg-slate-900">
        {/* Slide images */}
        {slides.map((s, i) => (
          <div
            key={i}
            className={cn(
              'absolute inset-0 transition-opacity duration-700 ease-in-out',
              i === current ? 'opacity-100' : 'opacity-0',
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.imageUrl}
              alt={s.title || `Banner ${i + 1}`}
              className="h-full w-full object-cover"
              loading={i === 0 ? 'eager' : 'lazy'}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
          </div>
        ))}

        {/* Content overlay */}
        <div className="container-tight relative z-10 py-12 sm:py-20 md:py-28 lg:py-32">
          <div className="max-w-2xl text-white">
            {slide.title && (
              <h1
                className="font-extrabold leading-[1.15] tracking-tight drop-shadow-lg"
                style={{ fontSize: 'clamp(1.5rem, 6vw, 3.75rem)' }}
              >
                {slide.title}
              </h1>
            )}
            {slide.subtitle && (
              <p className="mt-3 text-sm leading-relaxed text-white/80 drop-shadow sm:mt-6 sm:text-lg md:text-xl">
                {slide.subtitle}
              </p>
            )}
            <div className="mt-5 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:gap-4">
              <Link
                href={slide.ctaLink || `/${locale}/products`}
                className={cn(
                  'flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-white px-6 py-3.5 font-bold text-blue-700',
                  'shadow-soft-lg transition-all hover:bg-blue-50 hover:shadow-glow-primary active:scale-[0.98]',
                  'sm:w-auto sm:px-8 sm:py-4 sm:text-lg',
                )}
              >
                <ShoppingBag className="h-5 w-5" />
                {slide.ctaText || t('shopNow')}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={`/${locale}/wholesale`}
                className={cn(
                  'flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl border-2 border-white/30 px-6 py-3.5 font-bold text-white',
                  'backdrop-blur-sm transition-all hover:border-white/60 hover:bg-white/10 active:scale-[0.98]',
                  'sm:w-auto sm:px-8 sm:py-4 sm:text-lg',
                )}
              >
                <Package className="h-5 w-5" />
                {t('wholesaleHub')}
              </Link>
            </div>
          </div>
        </div>

        {/* Navigation arrows */}
        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-3 top-1/2 z-20 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-all hover:bg-white/30 sm:left-5 sm:h-12 sm:w-12"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-3 top-1/2 z-20 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-all hover:bg-white/30 sm:right-5 sm:h-12 sm:w-12"
              aria-label="Next slide"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2 sm:bottom-6">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrent(i)}
                className={cn(
                  'h-2 rounded-full transition-all',
                  i === current ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/60',
                )}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        )}

        {/* Decorative blurs */}
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-indigo-400/10 blur-3xl" />
      </section>
    );
  }

  /* ─── Fallback static hero ─── */
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white dark:from-blue-900 dark:via-blue-950 dark:to-indigo-950">
      <div className="absolute inset-0 bg-[url('/pattern.svg')] opacity-[0.07]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

      <div className="container-tight relative py-10 sm:py-20 md:py-28 lg:py-32">
        <div className="max-w-2xl">
          <h1
            className="font-extrabold leading-[1.15] tracking-tight"
            style={{ fontSize: 'clamp(1.5rem, 6vw, 3.75rem)' }}
          >
            {t('title')}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-blue-100/90 sm:mt-6 sm:text-lg md:text-xl">
            {t('subtitle')}
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:gap-4">
            <Link
              href={`/${locale}/products`}
              className={cn(
                'flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-white px-6 py-3.5 font-bold text-blue-700',
                'shadow-soft-lg transition-all hover:bg-blue-50 hover:shadow-glow-primary active:scale-[0.98]',
                'sm:w-auto sm:px-8 sm:py-4 sm:text-lg',
              )}
            >
              <ShoppingBag className="h-5 w-5" />
              {t('shopNow')}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/wholesale`}
              className={cn(
                'flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl border-2 border-white/30 px-6 py-3.5 font-bold text-white',
                'backdrop-blur-sm transition-all hover:border-white/60 hover:bg-white/10 active:scale-[0.98]',
                'sm:w-auto sm:px-8 sm:py-4 sm:text-lg',
              )}
            >
              <Package className="h-5 w-5" />
              {t('wholesaleHub')}
            </Link>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full bg-indigo-400/15 blur-3xl" />
    </section>
  );
}
