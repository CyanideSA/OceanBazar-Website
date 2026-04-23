import React, { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { BadgeCheck, ChevronLeft, ChevronRight, Quote, Sparkles, Star } from 'lucide-react';
import { normalizeProductImageUrl, resolveMediaUrl } from '../utils/mediaUrl';

function initials(name) {
  if (!name || typeof name !== 'string') return '?';
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

/**
 * Auto-advancing testimonial slider (Embla). Data from site_settings.testimonials (Mongo via public API).
 */
export default function TestimonialCarousel({ items = [], rotationMs = 6000 }) {
  const list = (items || []).filter((t) => t && (t.quote || t.comment));
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: list.length > 1, align: 'center' });
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (!emblaApi || list.length <= 1 || paused) return undefined;
    const ms = Math.max(4000, Number(rotationMs) || 6000);
    const id = setInterval(() => emblaApi.scrollNext(), ms);
    return () => clearInterval(id);
  }, [emblaApi, list.length, rotationMs, paused]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  if (!list.length) return null;

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-gradient-to-br from-white via-[#f5fafd] to-[#e8f4fb] dark:from-gray-800/90 dark:via-gray-900 dark:to-gray-800/80 p-5 sm:p-8 shadow-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Customer testimonials"
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 inline-flex items-center gap-2 text-[#5BA3D0]">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
            <span className="text-xs font-bold uppercase tracking-widest">Social proof</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
            What buyers say
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-lg">
            Verified-style reviews from wholesale and retail customers. Swipe or use arrows to explore.
          </p>
        </div>
        {list.length > 1 ? (
          <div className="flex gap-2 self-end sm:self-auto">
            <button
              type="button"
              aria-label="Previous testimonial"
              onClick={scrollPrev}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 shadow-sm transition-colors hover:border-[#5BA3D0] hover:text-[#5BA3D0]"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next testimonial"
              onClick={scrollNext}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 shadow-sm transition-colors hover:border-[#5BA3D0] hover:text-[#5BA3D0]"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex touch-pan-y">
          {list.map((t, i) => {
            const quote = String(t.quote || t.comment || '').trim();
            const rating = Math.min(5, Math.max(0, Math.round(Number(t.rating) || 5)));
            const verified = Boolean(t.verified);
            return (
              <div key={i} className="min-w-0 flex-[0_0_100%] px-1 sm:px-4">
                <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5BA3D0]/15 text-[#5BA3D0] dark:bg-[#5BA3D0]/20">
                    <Quote className="h-7 w-7" aria-hidden />
                  </div>
                  <div className="mb-3 flex items-center justify-center gap-0.5">
                    {[...Array(5)].map((_, j) => (
                      <Star
                        key={j}
                        className={`h-4 w-4 sm:h-5 sm:w-5 ${
                          j < rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200 dark:text-gray-600'
                        }`}
                      />
                    ))}
                    {verified ? (
                      <BadgeCheck className="ml-2 h-5 w-5 text-emerald-500 shrink-0" aria-label="Verified buyer" />
                    ) : null}
                  </div>
                  <blockquote className="text-base sm:text-lg leading-relaxed text-gray-800 dark:text-gray-100 font-medium">
                    <span className="text-[#5BA3D0] opacity-80">&ldquo;</span>
                    {quote}
                    <span className="text-[#5BA3D0] opacity-80">&rdquo;</span>
                  </blockquote>
                  <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#5BA3D0] to-[#7BB8DC] text-sm font-bold text-white shadow-md ring-2 ring-white dark:ring-gray-800 overflow-hidden">
                      {t.avatarUrl ? (
                        <img
                          src={resolveMediaUrl(normalizeProductImageUrl(t.avatarUrl))}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold tracking-tight">{initials(t.name)}</span>
                      )}
                    </div>
                    <div className="text-center sm:text-left">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{t.name || 'OceanBazar buyer'}</p>
                      {t.title ? <p className="text-xs text-gray-500 dark:text-gray-400">{t.title}</p> : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {list.length > 1 ? (
        <div className="mt-6 flex justify-center gap-2">
          {list.map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Testimonial ${idx + 1}`}
              aria-current={idx === selected}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === selected ? 'w-8 bg-[#5BA3D0]' : 'w-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400'
              }`}
              onClick={() => emblaApi?.scrollTo(idx)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
