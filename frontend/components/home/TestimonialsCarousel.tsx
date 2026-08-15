'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Quote, Star } from 'lucide-react';
import { storefrontApi } from '@/lib/api';
import {
  STOREFRONT_SETTINGS_QUERY_KEY,
  coalesceStorefrontSettings,
} from '@/lib/storefrontSettings';
import type { StorefrontPublicSettings } from '@/lib/fetchStorefrontCatalog';

type Testimonial = {
  name?: string;
  title?: string;
  quote?: string;
  comment?: string;
  rating?: number;
  verified?: boolean;
  avatarUrl?: string;
};

export default function TestimonialsCarousel({
  initialSettings,
}: {
  initialSettings?: StorefrontPublicSettings;
}) {
  const { data: remote } = useQuery({
    queryKey: STOREFRONT_SETTINGS_QUERY_KEY,
    queryFn: () => storefrontApi.settings().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    initialData: initialSettings,
  });

  const settings = useMemo(
    () => coalesceStorefrontSettings(remote, initialSettings),
    [remote, initialSettings],
  );

  const items = (Array.isArray(settings?.testimonials) ? settings.testimonials : []) as Testimonial[];
  const usable = items.filter((t) => String(t.quote || t.comment || '').trim());
  const intervalMs = Math.max(2000, Number(settings?.testimonialCarouselMs) || 6000);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (usable.length < 2) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % usable.length);
    }, intervalMs);
    return () => window.clearInterval(t);
  }, [usable.length, intervalMs]);

  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'078c95'},body:JSON.stringify({sessionId:'078c95',runId:'trust-badges',hypothesisId:'T2',location:'TestimonialsCarousel.tsx',message:'premium testimonials mount',data:{count:usable.length,intervalMs},timestamp:Date.now()})}).catch(()=>{});
  }, [usable.length, intervalMs]);
  // #endregion

  if (!usable.length) return null;

  const current = usable[idx] || usable[0];
  const quote = String(current.quote || current.comment || '').trim();
  const rating = Math.min(5, Math.max(1, Number(current.rating) || 5));
  const initials = String(current.name || 'OB')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <section
      className="relative overflow-hidden section-padding"
      data-ob-testimonials={String(usable.length)}
      data-ob-testimonial-ms={String(intervalMs)}
      aria-roledescription="carousel"
      aria-label="Customer testimonials"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(14,116,144,0.14),_transparent_55%),linear-gradient(180deg,_rgba(15,23,42,0.03),_transparent)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.12),_transparent_55%),linear-gradient(180deg,_rgba(2,6,23,0.35),_transparent)]"
        aria-hidden
      />
      <div className="relative container-tight max-w-4xl">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700/90 dark:text-cyan-300/90">
            Voices of trust
          </p>
          <h2 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Customers who choose authenticity
          </h2>
        </div>

        <div className="relative mx-auto mt-8 overflow-hidden rounded-[1.75rem] border border-white/40 bg-white/70 p-6 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur-md dark:border-white/10 dark:bg-slate-950/50 sm:p-10">
          <Quote className="absolute right-6 top-6 h-12 w-12 text-cyan-600/15 dark:text-cyan-300/15 sm:right-8 sm:top-8 sm:h-16 sm:w-16" aria-hidden />
          <div className="flex justify-center gap-1" aria-hidden>
            {Array.from({ length: rating }).map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <blockquote className="relative mt-5 text-center font-serif text-xl font-medium leading-relaxed text-foreground sm:text-2xl text-pretty">
            “{quote}”
          </blockquote>
          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-600 to-slate-900 text-sm font-bold text-white shadow-md">
              {current.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">
                {current.name || 'OceanBazar customer'}
              </p>
              {current.title ? (
                <p className="text-xs text-muted-foreground">{current.title}</p>
              ) : null}
              {current.verified ? (
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                  Verified purchase
                </p>
              ) : null}
            </div>
          </div>

          {usable.length > 1 ? (
            <div className="mt-8 flex justify-center gap-2" role="tablist">
              {usable.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === idx}
                  aria-label={`Testimonial ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === idx ? 'w-6 bg-cyan-700 dark:bg-cyan-300' : 'w-1.5 bg-border hover:bg-muted-foreground/40'
                  }`}
                  onClick={() => setIdx(i)}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
