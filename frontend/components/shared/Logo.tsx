'use client';

import Image from 'next/image';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { storefrontApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const FALLBACK_LIGHT = '/logo-light.png';
const FALLBACK_DARK = '/logo-dark.png';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
  /** Force a specific variant regardless of theme */
  variant?: 'light' | 'dark';
}

export default function Logo({ className, width = 200, height = 60, variant }: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['storefront-settings'],
    queryFn: () => storefrontApi.settings().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => setMounted(true), []);

  const lightSrc = settings?.logoLightUrl || FALLBACK_LIGHT;
  const darkSrc = settings?.logoDarkUrl || FALLBACK_DARK;

  if (!mounted) {
    return <div className={cn('animate-pulse rounded bg-transparent', className)} style={{ width, height }} />;
  }

  const isDark = variant === 'dark' || (variant !== 'light' && resolvedTheme === 'dark');
  const src = isDark ? darkSrc : lightSrc;

  return (
    <span className={cn('inline-flex shrink-0 items-center', className)} style={{ width, height }}>
      <Image
        src={src}
        alt="OceanBazar"
        width={width}
        height={height}
        priority
        className="h-full w-full object-contain"
        style={{ background: 'transparent' }}
      />
    </span>
  );
}
