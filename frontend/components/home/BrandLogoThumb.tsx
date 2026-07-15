'use client';

import { useState } from 'react';
import { cloudinaryUrl, resolvePublicMediaUrl } from '@/lib/mediaUrl';
import { cn } from '@/lib/utils';

type Props = {
  logoUrl: string | null | undefined;
  initialsSource: string;
  className?: string;
};

/** Brand logo with resilient URL resolution + Cloudinary sizing; monogram fallback if missing / 404. */
export default function BrandLogoThumb({ logoUrl, initialsSource, className }: Props) {
  const [failed, setFailed] = useState(false);
  const raw = resolvePublicMediaUrl(logoUrl ?? null);
  const src = raw ? cloudinaryUrl(raw, { width: 160, height: 160, crop: 'pad' }) : '';

  const letters = initialsSource
    .replace(/[^\p{L}\p{N}]/gu, '')
    .slice(0, 2)
    .toUpperCase() || '?';

  if (!src || failed) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center rounded-md bg-primary/12 text-[10px] font-bold uppercase tracking-tight text-primary sm:text-[11px]',
          className,
        )}
        aria-hidden
      >
        {letters}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className={cn('h-full w-full object-contain p-0.5', className)}
      loading="lazy"
      referrerPolicy="no-referrer"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
