'use client';

import Image from 'next/image';
import type { Category } from '@/types';
import { getMediaUrl } from '@/lib/mediaUrl';
import { cn } from '@/lib/utils';

const DEFAULT_EMOJI = '📦';

function isImageSrc(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  const v = value.trim();
  return v.startsWith('http://') || v.startsWith('https://') || v.startsWith('/') || v.includes('cloudinary.com');
}

type Props = {
  category: Pick<Category, 'nameEn' | 'icon' | 'imageUrl'>;
  size?: 'sm' | 'md';
  className?: string;
};

export default function CategoryLabelVisual({ category, size = 'sm', className }: Props) {
  const dim = size === 'md' ? 40 : 28;
  const imageSrc = category.imageUrl?.trim()
    ? getMediaUrl(category.imageUrl)
    : isImageSrc(category.icon)
      ? getMediaUrl(category.icon!)
      : null;

  if (imageSrc) {
    return (
      <span
        className={cn('relative shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted', className)}
        style={{ width: dim, height: dim }}
      >
        <Image
          src={imageSrc}
          alt=""
          width={dim}
          height={dim}
          unoptimized
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  const emoji = category.icon?.trim() || DEFAULT_EMOJI;
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg bg-muted/80 text-center leading-none',
        size === 'md' ? 'text-2xl' : 'text-lg',
        className,
      )}
      style={{ width: dim, height: dim }}
      aria-hidden
    >
      {emoji}
    </span>
  );
}
