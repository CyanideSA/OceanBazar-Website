import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';
import { normalizeProductImageUrl, resolveMediaUrl } from '../utils/mediaUrl';

export function WaveDivider({ className = '' }) {
  return (
    <div
      className={`pointer-events-none absolute bottom-0 left-0 right-0 z-[6] overflow-hidden h-12 sm:h-14 ${className}`}
      aria-hidden
    >
      <div className="ob-wave-track absolute bottom-0 left-0 flex h-full w-[200%] will-change-transform">
        <svg className="h-full w-1/2 shrink-0 text-white/45 dark:text-white/30" viewBox="0 0 720 56" preserveAspectRatio="none">
          <path
            fill="currentColor"
            d="M0,38 C90,18 180,48 270,28 C360,8 450,42 540,24 C630,6 720,36 720,36 L720,56 L0,56 Z"
          />
        </svg>
        <svg className="h-full w-1/2 shrink-0 text-white/45 dark:text-white/30" viewBox="0 0 720 56" preserveAspectRatio="none">
          <path
            fill="currentColor"
            d="M0,38 C90,18 180,48 270,28 C360,8 450,42 540,24 C630,6 720,36 720,36 L720,56 L0,56 Z"
          />
        </svg>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-t from-black/10 to-transparent dark:from-black/25" />
    </div>
  );
}

/**
 * Horizontal slide carousel with animated ocean-wave footer. Used for hero and product-area banners.
 */
export default function WaveBannerCarousel({
  slides = [],
  rotationMs = 6000,
  variant = 'hero',
  className = '',
  compactSpacing = false,
}) {
  const sorted = useMemo(() => {
    const rows = (slides || []).filter((s) => s && s.imageUrl);
    return [...rows].sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
  }, [slides]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef(null);

  const len = sorted.length;
  const safeIndex = len ? ((index % len) + len) % len : 0;

  const rotationSig = sorted.map((s) => String(s?.rotationMs ?? "")).join("|");

  useEffect(() => {
    if (len <= 1 || paused) return undefined;
    const current = sorted[safeIndex];
    const perSlide = Number(current?.rotationMs);
    const ms = Math.max(2800, (Number.isFinite(perSlide) && perSlide > 0 ? perSlide : Number(rotationMs)) || 6000);
    const t = window.setTimeout(() => {
      setIndex((i) => (i + 1) % len);
    }, ms);
    return () => window.clearTimeout(t);
  }, [len, rotationMs, paused, safeIndex, rotationSig]);

  const go = useCallback(
    (dir) => {
      if (!len) return;
      setIndex((i) => (i + dir + len) % len);
    },
    [len]
  );

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null || !len) return;
    const dx = e.changedTouches[0].clientX - start;
    if (dx > 56) go(-1);
    else if (dx < -56) go(1);
  };

  const isHero = variant === 'hero';
  const frameClass = isHero
    ? 'min-h-[220px] sm:min-h-[280px] lg:min-h-[320px]'
    : 'aspect-[5/1] min-h-[100px] max-h-[200px] sm:max-h-[220px]';

  if (!len) return null;

  const marginCls = compactSpacing ? 'mb-5 sm:mb-6' : 'mb-8 sm:mb-10';

  return (
    <div
      className={`group/banner relative ${marginCls} overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-100 dark:bg-gray-800/50 shadow-sm ${frameClass} ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="flex h-full min-h-0 w-full transition-transform duration-700 motion-reduce:transition-none motion-reduce:duration-0 ease-out"
        style={{ transform: `translateX(-${safeIndex * 100}%)` }}
      >
        {sorted.map((slide, idx) => {
          const src = resolveMediaUrl(normalizeProductImageUrl(slide.imageUrl));
          const inner = (
            <>
              <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" loading={idx === 0 ? 'eager' : 'lazy'} />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent dark:from-black/70 dark:via-black/40" />
              {isHero ? (
                <div className="relative z-[2] flex h-full flex-col justify-center px-5 py-8 sm:px-8 sm:py-10 lg:px-12 text-white max-w-xl">
                  <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm border border-white/20 w-fit">
                    <ImageIcon className="h-3 w-3 opacity-90" aria-hidden />
                    Featured
                  </div>
                  {slide.title ? (
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight drop-shadow-sm">{slide.title}</h1>
                  ) : null}
                  {slide.subtitle ? (
                    <p className="mt-2 text-sm sm:text-base text-white/90 leading-relaxed drop-shadow-sm max-w-md">{slide.subtitle}</p>
                  ) : null}
                  {slide.linkUrl ? (
                    <a
                      href={slide.linkUrl}
                      className="mt-5 inline-flex w-fit items-center gap-2 rounded-xl border border-white/25 bg-white/20 px-4 py-2.5 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                    >
                      Shop now <ArrowRight className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  {slide.title ? (
                    <div className="absolute bottom-3 left-3 right-3 z-[2] text-sm font-semibold text-white drop-shadow-md line-clamp-2">
                      {slide.title}
                    </div>
                  ) : null}
                </>
              )}
            </>
          );

          const slideMin = isHero ? 'min-h-[220px] sm:min-h-[280px] lg:min-h-[320px]' : 'h-full min-h-[80px]';
          return (
            <div key={idx} className={`relative w-full shrink-0 ${slideMin}`}>
              {slide.linkUrl && !isHero ? (
                <a
                  href={slide.linkUrl}
                  className={`block h-full ${isHero ? '' : 'min-h-0'} focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5BA3D0] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900`}
                >
                  {inner}
                </a>
              ) : (
                inner
              )}
            </div>
          );
        })}
      </div>

      <WaveDivider />

      {len > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 z-[8] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/35 text-white opacity-0 backdrop-blur-md transition-opacity hover:bg-black/50 group-hover/banner:opacity-100 sm:opacity-100 md:h-10 md:w-10"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 z-[8] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/35 text-white opacity-0 backdrop-blur-md transition-opacity hover:bg-black/50 group-hover/banner:opacity-100 sm:opacity-100 md:h-10 md:w-10"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 z-[8] flex -translate-x-1/2 gap-1.5 sm:bottom-5">
            {sorted.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Go to slide ${idx + 1}`}
                aria-current={idx === safeIndex}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === safeIndex ? 'w-7 bg-white shadow-sm' : 'w-2 bg-white/45 hover:bg-white/70'
                }`}
                onClick={() => setIndex(idx)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
