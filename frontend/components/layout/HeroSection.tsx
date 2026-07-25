'use client';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type CSSProperties,
} from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, Package, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { storefrontApi } from '@/lib/api';
import { AB_TESTS, useAbVariant, trackAbEvent } from '@/lib/abTest';

interface HeroOverlay {
  id?: string;
  type: 'text' | 'button';
  text?: string;
  linkUrl?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  bgColor?: string;
  x?: number;
  y?: number;
}

interface HeroSlide {
  imageUrl: string;
  title?: string;
  subtitle?: string;
  ctaText?: string;
  ctaLink?: string;
  linkUrl?: string;
  overlays?: HeroOverlay[];
}

type HeroInitial = {
  heroSlides?: HeroSlide[];
  defaultBannerRotationMs?: number;
};

/** Must match admin CRM canvas (`aspect-[16/7]` + `object-cover`) so overlay % land on the same pixels. */
const ADMIN_CANVAS_ASPECT = 16 / 7;
const ADMIN_ASPECT_PADDING_PCT = (7 / 16) * 100;

function ensureGoogleFonts(families: string[]) {
  if (typeof document === 'undefined') return;
  const needed = [...new Set(families.filter(Boolean))];
  if (!needed.length) return;
  const id = 'ob-storefront-hero-fonts';
  let link = document.getElementById(id) as HTMLLinkElement | null;
  const familyQuery = needed
    .map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700;800`)
    .join('&');
  const href = `https://fonts.googleapis.com/css2?${familyQuery}&display=swap`;
  if (!link) {
    link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);
}

function legacyOverlays(slide: HeroSlide): HeroOverlay[] {
  if (Array.isArray(slide.overlays) && slide.overlays.length > 0) return slide.overlays;
  const out: HeroOverlay[] = [];
  if (slide.title) {
    out.push({
      type: 'text',
      text: slide.title,
      fontFamily: 'Inter',
      fontSize: 48,
      fontWeight: 800,
      color: '#ffffff',
      x: 8,
      y: 28,
    });
  }
  if (slide.subtitle) {
    out.push({
      type: 'text',
      text: slide.subtitle,
      fontFamily: 'Inter',
      fontSize: 18,
      fontWeight: 500,
      color: '#ffffff',
      x: 8,
      y: 42,
    });
  }
  if (slide.ctaText || slide.ctaLink || slide.linkUrl) {
    out.push({
      type: 'button',
      text: slide.ctaText || 'Shop Now',
      linkUrl: slide.ctaLink || slide.linkUrl || undefined,
      fontFamily: 'Inter',
      fontSize: 16,
      fontWeight: 700,
      color: '#0a5d61',
      bgColor: '#ffffff',
      x: 8,
      y: 58,
    });
  }
  return out;
}

/**
 * Scale overlay type to the live frame vs a ~desktop admin canvas (~900px wide).
 * Avoid clamp() for Safari 12; keep buttons readable on iPhone 7 (~375px).
 */
function overlayScale(frameWidth: number): number {
  const w = frameWidth || 375;
  return Math.min(1, Math.max(0.55, w / 900));
}

function SlideOverlays({
  slide,
  locale,
  frameWidth,
}: {
  slide: HeroSlide;
  locale: string;
  frameWidth: number;
}) {
  const overlays = legacyOverlays(slide);
  const scale = overlayScale(frameWidth);

  return (
    <div
      className="ob-hero-overlays"
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 10 }}
    >
      {overlays.map((ov, i) => {
        const fontPx = Math.max(11, Math.round((Number(ov.fontSize) || 16) * scale));
        const padY = Math.max(6, Math.round(10 * scale));
        const padX = Math.max(12, Math.round(20 * scale));
        const style: CSSProperties = {
          position: 'absolute',
          left: `${Number(ov.x) || 0}%`,
          top: `${Number(ov.y) || 0}%`,
          fontFamily: `"${ov.fontFamily || 'Inter'}", system-ui, -apple-system, sans-serif`,
          fontSize: `${fontPx}px`,
          fontWeight: Number(ov.fontWeight) || 600,
          color: ov.color || '#fff',
          maxWidth: '90%',
          lineHeight: 1.25,
          textShadow: ov.type === 'text' ? '0 1px 3px rgba(0,0,0,0.45)' : undefined,
        };
        if (ov.type === 'button') {
          const href = ov.linkUrl || `/${locale}/products`;
          return (
            <a
              key={ov.id || `btn-${i}`}
              href={href}
              className="ob-hero-overlay-btn"
              style={{
                ...style,
                display: 'inline-block',
                background: ov.bgColor || '#ffffff',
                color: ov.color || '#0a5d61',
                borderRadius: 12,
                padding: `${padY}px ${padX}px`,
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                zIndex: 11,
              }}
            >
              {ov.text || 'Shop Now'}
            </a>
          );
        }
        return (
          <div
            key={ov.id || `txt-${i}`}
            className="ob-hero-overlay-text"
            style={{ ...style, zIndex: 11, whiteSpace: 'pre-wrap' }}
          >
            {ov.text}
          </div>
        );
      })}
    </div>
  );
}

export default function HeroSection({ initial }: { initial?: HeroInitial }) {
  const t = useTranslations('home.hero');
  const locale = useLocale();
  const heroVariant = useAbVariant(AB_TESTS.HERO_BANNER);
  const [current, setCurrent] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [frameWidth, setFrameWidth] = useState(375);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const autoplayLock = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: settings } = useQuery({
    queryKey: ['storefront-settings'],
    queryFn: () => storefrontApi.settings().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const slides: HeroSlide[] = (settings?.heroSlides?.length
    ? settings.heroSlides
    : initial?.heroSlides?.length
      ? initial.heroSlides
      : []) as HeroSlide[];
  const rotationMs = settings?.defaultBannerRotationMs || initial?.defaultBannerRotationMs || 6000;
  const hasSlides = slides.length > 0;

  const fontFamilies = useMemo(() => {
    const fams: string[] = [];
    for (const s of slides) {
      for (const o of legacyOverlays(s)) {
        if (o.fontFamily) fams.push(o.fontFamily);
      }
    }
    return fams;
  }, [slides]);

  useEffect(() => {
    ensureGoogleFonts(fontFamilies);
  }, [fontFamilies]);

  const measureFrame = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const w = el.clientWidth || window.innerWidth || 375;
    setFrameWidth(w);
  }, []);

  useEffect(() => {
    measureFrame();
    window.addEventListener('resize', measureFrame);
    return () => window.removeEventListener('resize', measureFrame);
  }, [measureFrame, hasSlides]);

  const scrollToIndex = useCallback(
    (index: number, behavior: ScrollBehavior = 'smooth') => {
      const el = trackRef.current;
      if (!el || slides.length === 0) return;
      const i = ((index % slides.length) + slides.length) % slides.length;
      const width = el.clientWidth || 1;
      el.scrollTo({ left: width * i, behavior });
      setCurrent(i);
    },
    [slides.length],
  );

  const next = useCallback(() => {
    scrollToIndex(current + 1);
    void trackAbEvent(AB_TESTS.HERO_BANNER, 'hero_next', { metadata: { variant: heroVariant } });
  }, [current, scrollToIndex, heroVariant]);

  const prev = useCallback(() => {
    scrollToIndex(current - 1);
    void trackAbEvent(AB_TESTS.HERO_BANNER, 'hero_prev', { metadata: { variant: heroVariant } });
  }, [current, scrollToIndex, heroVariant]);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  }, [mounted]);

  // Keep `current` in sync when the user swipes (works even if autoplay JS is slow).
  useEffect(() => {
    const el = trackRef.current;
    if (!el || slides.length < 2) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const width = el.clientWidth || 1;
        const idx = Math.round(el.scrollLeft / width);
        if (idx !== current && idx >= 0 && idx < slides.length) setCurrent(idx);
        autoplayLock.current = true;
        window.setTimeout(() => {
          autoplayLock.current = false;
        }, 400);
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [slides.length, current]);

  // Autoplay for every visitor with 2+ slides (do not gate on AB variant B).
  useEffect(() => {
    if (!mounted || slides.length <= 1 || prefersReducedMotion) return;
    const id = window.setInterval(() => {
      if (autoplayLock.current) return;
      const el = trackRef.current;
      if (!el) return;
      const width = el.clientWidth || 1;
      const idx = Math.round(el.scrollLeft / width);
      const nextIdx = (idx + 1) % slides.length;
      el.scrollTo({ left: width * nextIdx, behavior: 'smooth' });
      setCurrent(nextIdx);
    }, rotationMs);
    return () => window.clearInterval(id);
  }, [mounted, slides.length, rotationMs, prefersReducedMotion]);


  /* ─── Carousel Hero (admin-configured slides) ─── */
  if (hasSlides) {
    const useCanvasOverlays = legacyOverlays(slides[current] || slides[0]).length > 0;

    return (
      <section
        className="ob-hero-section relative w-full overflow-hidden bg-slate-950"
        data-ob-hero-slides={String(slides.length)}
        data-ob-hero-ssr={String(Boolean(initial?.heroSlides?.length))}
        data-ob-hero-fit="cover-16-7"
        data-ob-hero-js={mounted ? '1' : '0'}
        data-ob-hero-variant={heroVariant}
        style={{ position: 'relative', width: '100%', backgroundColor: '#020617' }}
      >
        {/*
          Scroll-snap track: swipe works on iPhone 7 even if React hydration is slow/broken.
          Each slide uses the same 16/7 + object-cover canvas as the admin CRM editor
          so overlay x/y % match the designed hotspot.
        */}
        <div
          ref={trackRef}
          className="ob-hero-track"
          style={{
            display: 'flex',
            width: '100%',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {slides.map((s, i) => (
            <div
              key={i}
              className="ob-hero-slide"
              style={{
                position: 'relative',
                flex: '0 0 100%',
                width: '100%',
                maxWidth: '100%',
                scrollSnapAlign: 'start',
                scrollSnapStop: 'always',
                backgroundColor: '#020617',
              }}
              aria-hidden={mounted ? i !== current : i !== 0}
            >
              <div aria-hidden style={{ width: '100%', paddingTop: `${ADMIN_ASPECT_PADDING_PCT}%` }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.imageUrl}
                alt={s.title || `Banner ${i + 1}`}
                className="ob-hero-img"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center center',
                }}
                loading={i === 0 ? 'eager' : 'eager'}
                decoding="async"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.visibility = 'hidden';
                }}
              />
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                  background: 'linear-gradient(to top, rgba(0,0,0,0.28), transparent 50%)',
                  pointerEvents: 'none',
                }}
              />
              {legacyOverlays(s).length > 0 ? (
                <SlideOverlays slide={s} locale={locale} frameWidth={frameWidth} />
              ) : null}
            </div>
          ))}
        </div>

        <style>{`
          .ob-hero-track::-webkit-scrollbar { display: none; height: 0; }
        `}</style>

        {!useCanvasOverlays && (
          <div className="container-tight relative z-10 py-12 sm:py-20" style={{ position: 'relative', zIndex: 10 }}>
            <div className="max-w-2xl text-white">
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:gap-4">
                <Link
                  href={`/${locale}/products`}
                  className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-white px-6 py-3.5 font-bold text-blue-700 sm:w-auto"
                >
                  <ShoppingBag className="h-5 w-5" />
                  {t('shopNow')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={`/${locale}/wholesale`}
                  className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl border-2 border-white/30 px-6 py-3.5 font-bold text-white sm:w-auto"
                >
                  <Package className="h-5 w-5" />
                  {t('wholesaleHub')}
                </Link>
              </div>
            </div>
          </div>
        )}

        {slides.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-3 top-1/2 z-20 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white sm:left-5 sm:h-12 sm:w-12"
              aria-label="Previous slide"
              style={{ position: 'absolute', zIndex: 20 }}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-3 top-1/2 z-20 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white sm:right-5 sm:h-12 sm:w-12"
              aria-label="Next slide"
              style={{ position: 'absolute', zIndex: 20 }}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div
              className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2 sm:bottom-6"
              style={{
                position: 'absolute',
                zIndex: 20,
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
              }}
            >
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => scrollToIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  style={{
                    height: 8,
                    width: i === current ? 24 : 8,
                    borderRadius: 999,
                    border: 'none',
                    background: i === current ? '#fff' : 'rgba(255,255,255,0.45)',
                    padding: 0,
                    cursor: 'pointer',
                    marginLeft: i === 0 ? 0 : 8,
                    transition: prefersReducedMotion ? undefined : 'width 0.35s ease, background-color 0.35s ease',
                  }}
                />
              ))}
            </div>
          </>
        )}
      </section>
    );
  }

  /* ─── Fallback static hero ─── */
  return (
    <section className="relative overflow-hidden bg-blue-700 text-white" style={{ backgroundColor: '#1d4ed8' }}>
      <div className="container-tight relative py-10 sm:py-20 md:py-28">
        <div className="max-w-2xl">
          <h1 className="font-extrabold leading-[1.15] tracking-tight" style={{ fontSize: '2rem' }}>
            {t('title')}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-blue-100 sm:mt-6 sm:text-lg">
            {t('subtitle')}
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:gap-4">
            <Link
              href={`/${locale}/products`}
              className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl bg-white px-6 py-3.5 font-bold text-blue-700 sm:w-auto"
            >
              <ShoppingBag className="h-5 w-5" />
              {t('shopNow')}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/wholesale`}
              className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl border-2 border-white/30 px-6 py-3.5 font-bold text-white sm:w-auto"
            >
              <Package className="h-5 w-5" />
              {t('wholesaleHub')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
