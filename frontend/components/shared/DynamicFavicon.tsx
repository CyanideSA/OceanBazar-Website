'use client';

import { useTheme } from 'next-themes';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { storefrontApi } from '@/lib/api';
import {
  STOREFRONT_SETTINGS_QUERY_KEY,
  coalesceStorefrontSettings,
} from '@/lib/storefrontSettings';
import type { StorefrontPublicSettings } from '@/lib/fetchStorefrontCatalog';

/**
 * Dynamically switches the favicon based on the current theme,
 * preferring CRM faviconUrl when set.
 */
export default function DynamicFavicon({
  initialSettings,
}: {
  initialSettings?: StorefrontPublicSettings;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

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

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;

    const cms = String(settings?.faviconUrl || '').trim();
    const href = cms || (resolvedTheme === 'dark' ? '/favicon-dark.svg' : '/favicon-light.svg');
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }

    if (cms) {
      link.removeAttribute('type');
    } else {
      link.type = 'image/svg+xml';
    }
    link.href = href;
  }, [resolvedTheme, mounted, settings?.faviconUrl]);

  return null;
}
