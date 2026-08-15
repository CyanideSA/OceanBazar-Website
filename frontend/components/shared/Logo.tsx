'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { storefrontApi } from '@/lib/api';

/**
 * Canonical hi-res master (opaque JPEG for print / approvals / CMS reference).
 * UI marks use transparent PNGs below — regenerate JPEG from the same source artwork when the brand updates.
 */
export const LOGO_SRC_MASTER_JPG = '/header-logo.jpg';
/** Bump when replacing public PNGs so browsers skip stale cached logos. */
export const LOGO_ASSET_VERSION = '7';
/** Transparent header mark — header, auth, login dialog (no spaces: reliable cache + alpha) */
export const LOGO_SRC_BRAND = `/ob-brand-logo.png?v=${LOGO_ASSET_VERSION}`;
/** Transparent footer mark — storefront footer + Admin CRM shell */
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
  /** When true, skip CMS logoLightUrl / logoDarkUrl and use src / defaults only. */
  ignoreCms?: boolean;
}

export default function Logo({
  className,
  imageClassName,
  width = 200,
  height = 60,
  src,
  variant: _variant,
  interaction = 'brand',
  priority = false,
  ignoreCms = false,
}: LogoProps) {
  void _variant;
  const fluid = interaction === 'footer';
  const defaultSrc = interaction === 'footer' ? LOGO_SRC_TRANSPARENT : LOGO_SRC_BRAND;
  const [cmsSrc, setCmsSrc] = useState('');

  useEffect(() => {
    if (ignoreCms) return;
    let cancelled = false;
    storefrontApi
      .settings()
      .then((r) => {
        if (cancelled) return;
        const settings = r?.data || {};
        const next =
          interaction === 'footer'
            ? String(settings.logoDarkUrl || settings.logoLightUrl || '').trim()
            : String(settings.logoLightUrl || settings.logoDarkUrl || '').trim();
        if (next) setCmsSrc(next);
        // #region agent log
        fetch('http://127.0.0.1:7860/ingest/edcc0735-42b6-4958-a62f-412af4249672',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'078c95'},body:JSON.stringify({sessionId:'078c95',runId:'settings-e2e',hypothesisId:'A',location:'Logo.tsx',message:'logo resolve',data:{interaction,usingCms:Boolean(next),resolvedHost:String(next || src || defaultSrc).slice(0,64)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ignoreCms, interaction, src, defaultSrc]);

  const explicitCustom =
    Boolean(src) && src !== LOGO_SRC_BRAND && src !== LOGO_SRC_TRANSPARENT && src !== defaultSrc;
  const resolvedSrc = explicitCustom
    ? (src as string)
    : !ignoreCms && cmsSrc
      ? cmsSrc
      : src || defaultSrc;

  return (
    <span
      data-logo-interaction={interaction}
      data-ob-logo-cms={cmsSrc ? '1' : '0'}
      className={cn(
        'ob-logo inline-flex items-center',
        fluid ? 'h-auto w-full max-w-full shrink' : 'shrink-0',
        className,
      )}
      style={
        fluid
          ? { width: '100%', maxWidth: '100%', aspectRatio: `${width} / ${height}` }
          : { width, height }
      }
    >
      <Image
        src={resolvedSrc}
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
