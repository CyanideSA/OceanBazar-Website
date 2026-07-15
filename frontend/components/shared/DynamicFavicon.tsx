'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

/**
 * Dynamically switches the favicon based on the current theme.
 * Light theme → /favicon-light.svg
 * Dark theme  → /favicon-dark.svg
 */
export default function DynamicFavicon() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;

    const href = resolvedTheme === 'dark' ? '/favicon-dark.svg' : '/favicon-light.svg';
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }

    link.type = 'image/svg+xml';
    link.href = href;
  }, [resolvedTheme, mounted]);

  return null;
}
