'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Canonical hi-res master (opaque JPEG for print / approvals / CMS reference).
 * UI marks use transparent PNGs below — regenerate JPEG from the same source artwork when the brand updates.
 */
export const LOGO_SRC_MASTER_JPG = '/header-logo.jpg';
/** Bump when replacing public PNGs so browsers skip stale cached logos. */
export const LOGO_ASSET_VERSION = '5';
/** Transparent header mark — header, auth, dialogs, welcome popup (no spaces: reliable cache + alpha) */
export const LOGO_SRC_BRAND = `/ob-brand-logo.png?v=${LOGO_ASSET_VERSION}`;
/** Transparent footer mark — storefront footer */
export const LOGO_SRC_TRANSPARENT = `/ob-footer-logo.png?v=${LOGO_ASSET_VERSION}`;

export type LogoInteraction = 'brand' | 'footer' | 'none';

interface LogoProps {
  className?: string;
  imageClassName?: string;
  width?: number;
  height?: number;
  src?: string;
  /** Kept for backward compatibility — the same logo asset is used in both light and dark themes. */
  variant?: 'light' | 'dark';
  /** Hover behavior: brand = glow + scale pop; footer = glow only; none = static */
  interaction?: LogoInteraction;
  /** Prioritize only the immediately visible header logo. */
  priority?: boolean;
}

export default function Logo({
  className,
  imageClassName,
  width = 200,
  height = 60,
  src = LOGO_SRC_BRAND,
  variant: _variant,
  interaction = 'brand',
  priority = false,
}: LogoProps) {
  void _variant;

  return (
    <span
      data-logo-interaction={interaction}
      className={cn('ob-logo inline-flex shrink-0 items-center', className)}
      style={{ width, height }}
    >
      <Image
        src={src}
        alt="OceanBazar"
        width={width}
        height={height}
        priority={priority}
        unoptimized
        className={cn('ob-logo__img h-full w-full object-contain', imageClassName)}
        style={{ background: 'transparent' }}
      />
    </span>
  );
}
