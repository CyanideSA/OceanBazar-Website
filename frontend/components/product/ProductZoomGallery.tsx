'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { getMediaUrl } from '@/lib/mediaUrl';
import type { ProductImage } from '@/types';
import { cn } from '@/lib/utils';

/** Lens square size (px) over the main image */
const LENS = 100;
/** Floating zoom box size (px) */
const ZOOM_BOX = 320;
/** Gap between cursor and the floating zoom box */
const FLOAT_OFFSET = 16;
/** Scale factor: how many times bigger the zoomed image is */
const SCALE = ZOOM_BOX / LENS;

interface Props {
  images: ProductImage[];
  title: string;
  activeIndex: number;
  onSelectIndex: (i: number) => void;
}

export default function ProductZoomGallery({ images, title, activeIndex, onSelectIndex }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);

  /* Zoom state */
  const [zooming, setZooming]   = useState(false);
  /* lens position in page coords */
  const [lensPage, setLensPage] = useState({ x: 0, y: 0 });
  /* floating zoom box position in viewport */
  const [floatPos, setFloatPos] = useState({ x: 0, y: 0 });
  /* fraction (0‒1) of cursor within the image */
  const [fraction, setFraction] = useState({ x: 0, y: 0 });
  /* image natural / rendered dimensions */
  const [imgRect, setImgRect] = useState({ left: 0, top: 0, w: 0, h: 0 });

  /* ── Touch / swipe ── */
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    touchStartX.current = null; touchStartY.current = null;
    if (Math.abs(dx) < 30 || dy > Math.abs(dx)) return;
    if (dx < 0) onSelectIndex(Math.min(activeIndex + 1, images.length - 1));
    else        onSelectIndex(Math.max(activeIndex - 1, 0));
  };

  const current = images[activeIndex];
  const isVideo = current?.mediaType === 'video';
  const src = current?.url ? getMediaUrl(current.url) : '';

  /* Recalculate image bounding rect */
  const measureImg = useCallback(() => {
    const el = imgRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setImgRect({ left: r.left, top: r.top, w: r.width, h: r.height });
  }, []);

  /* Re-measure on resize/scroll */
  useEffect(() => {
    window.addEventListener('resize', measureImg);
    window.addEventListener('scroll', measureImg, { passive: true });
    return () => {
      window.removeEventListener('resize', measureImg);
      window.removeEventListener('scroll', measureImg);
    };
  }, [measureImg]);

  /* Reset zoom when image changes */
  useEffect(() => { setZooming(false); }, [activeIndex]);

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isVideo) return;
      const el = imgRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();

      /* cursor relative to the image */
      const rx = e.clientX - r.left;
      const ry = e.clientY - r.top;
      if (rx < 0 || ry < 0 || rx > r.width || ry > r.height) { setZooming(false); return; }

      /* lens clamped inside image */
      const half = LENS / 2;
      const lx = Math.max(0, Math.min(rx - half, r.width  - LENS));
      const ly = Math.max(0, Math.min(ry - half, r.height - LENS));

      /* fraction used to translate the zoomed image */
      const fx = lx / (r.width  - LENS);
      const fy = ly / (r.height - LENS);

      /* floating box position — prefer right of cursor, flip left if near edge */
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let bx = e.clientX + FLOAT_OFFSET;
      let by = e.clientY - ZOOM_BOX / 2;
      if (bx + ZOOM_BOX > vw - 8) bx = e.clientX - FLOAT_OFFSET - ZOOM_BOX;
      by = Math.max(8, Math.min(by, vh - ZOOM_BOX - 8));

      setImgRect({ left: r.left, top: r.top, w: r.width, h: r.height });
      setLensPage({ x: r.left + lx + window.scrollX, y: r.top + ly + window.scrollY });
      setFloatPos({ x: bx, y: by });
      setFraction({ x: fx, y: fy });
      setZooming(true);
    },
    [isVideo]
  );

  /* Zoomed-image offset: how much to shift the image so the lens area is centred */
  const zoomed = {
    w: imgRect.w * SCALE,
    h: imgRect.h * SCALE,
    tx: -fraction.x * (imgRect.w * SCALE - ZOOM_BOX),
    ty: -fraction.y * (imgRect.h * SCALE - ZOOM_BOX),
  };

  return (
    <div className="space-y-3">
      {/* ── Main image ── */}
      <div
        className={cn(
          'relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-muted',
          !isVideo && 'lg:cursor-crosshair'
        )}
        onMouseMove={onMouseMove}
        onMouseLeave={() => setZooming(false)}
        onMouseEnter={measureImg}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {!src ? (
          <div className="flex h-full w-full items-center justify-center text-6xl text-muted-foreground/30">📦</div>
        ) : isVideo ? (
          <video src={src} controls className="h-full w-full object-cover" playsInline />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt={title}
              className="h-full w-full object-contain"
              onLoad={measureImg}
              draggable={false}
              loading="lazy"
            />
            {/* ── Lens box ── desktop only ── */}
            {zooming && (
              <div
                className="pointer-events-none absolute hidden border-2 border-primary/60 bg-primary/10 shadow-lg lg:block"
                style={{
                  width:  LENS,
                  height: LENS,
                  left: lensPage.x - imgRect.left - window.scrollX,
                  top:  lensPage.y - imgRect.top  - window.scrollY,
                }}
              />
            )}
          </>
        )}

        {/* Mobile prev/next arrows */}
        {images.length > 1 && (
          <>
            <button type="button" aria-label="Previous image"
              onClick={() => onSelectIndex(Math.max(activeIndex - 1, 0))}
              className={cn(
                'absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-background/80 p-1.5 shadow-md backdrop-blur-sm transition-opacity lg:hidden',
                activeIndex === 0 ? 'opacity-30 pointer-events-none' : 'opacity-80'
              )}
            >
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </button>
            <button type="button" aria-label="Next image"
              onClick={() => onSelectIndex(Math.min(activeIndex + 1, images.length - 1))}
              className={cn(
                'absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-background/80 p-1.5 shadow-md backdrop-blur-sm transition-opacity lg:hidden',
                activeIndex === images.length - 1 ? 'opacity-30 pointer-events-none' : 'opacity-80'
              )}
            >
              <ChevronRight className="h-5 w-5 text-foreground" />
            </button>
            {/* Dot indicators — mobile */}
            <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 lg:hidden">
              {images.map((_, i) => (
                <button key={i} type="button" aria-label={`Image ${i + 1}`}
                  onClick={() => onSelectIndex(i)}
                  className={cn('h-1.5 rounded-full transition-all',
                    i === activeIndex ? 'w-5 bg-primary' : 'w-1.5 bg-foreground/30')}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Floating zoom box — fixed to viewport, desktop only ── */}
      {zooming && src && !isVideo && (
        <div
          className="pointer-events-none fixed z-[9999] hidden overflow-hidden rounded-xl border-2 border-primary/40 bg-background shadow-2xl lg:block"
          style={{ width: ZOOM_BOX, height: ZOOM_BOX, left: floatPos.x, top: floatPos.y }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            draggable={false}
            style={{
              width:     zoomed.w,
              height:    zoomed.h,
              transform: `translate(${zoomed.tx}px, ${zoomed.ty}px)`,
              maxWidth:  'none',
            }}
          />
        </div>
      )}

      {/* ── Thumbnail strip ── */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {images.map((img, i) => {
            const u = getMediaUrl(img.url);
            return (
              <button
                key={img.id ?? i}
                type="button"
                onClick={() => onSelectIndex(i)}
                className={cn(
                  'relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-lg border-2 transition-colors sm:h-[72px] sm:w-[72px]',
                  i === activeIndex ? 'border-primary' : 'border-border hover:border-primary/50'
                )}
              >
                {img.mediaType === 'video' ? (
                  <div className="flex h-full w-full items-center justify-center bg-muted">
                    <Play className="h-5 w-5 text-muted-foreground" />
                  </div>
                ) : (
                  <Image src={u} alt="" width={64} height={64} className="h-full w-full object-cover" unoptimized={u.startsWith('http')} />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
