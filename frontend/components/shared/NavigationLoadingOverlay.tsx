'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { routeKeyFromLocation } from '@/lib/navigationRouteKey';
import { useNavigationLoadingContext } from '@/components/shared/NavigationLoadingContext';

/**
 * Full-screen loading during in-app navigation.
 * - Link taps: pointerdown on same-origin <a href> → loading until pathname/search updates.
 * - Programmatic: use useShopRouter().push / pushWithLoading from @/lib/shopNavigation.
 * Opt out: data-no-nav-loading="true" on an element or ancestor.
 */
export default function NavigationLoadingOverlay() {
  const ctx = useNavigationLoadingContext();
  const loading = ctx?.loading ?? false;
  const beginLinkNavigation = ctx?.beginLinkNavigation;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!beginLinkNavigation) return;

    const ignoreSubtree = (el: EventTarget | null) => {
      if (!(el instanceof Element)) return false;
      return Boolean(
        el.closest('[data-no-nav-loading="true"]') ||
          el.closest('button') ||
          el.closest('[role="button"]'),
      );
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (ignoreSubtree(e.target)) return;

      const t = e.target as HTMLElement;
      const a = t.closest('a[href]') as HTMLAnchorElement | null;
      if (!a?.href) return;
      if (a.target === '_blank' || a.hasAttribute('download')) return;
      if (a.getAttribute('href')?.startsWith('#')) return;

      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (!/^https?:$/.test(url.protocol)) return;

      const nextKey = routeKeyFromLocation(url.pathname, url.searchParams.toString());
      const curKey = routeKeyFromLocation(window.location.pathname, new URLSearchParams(window.location.search).toString());
      if (nextKey === curKey) return;

      beginLinkNavigation();
    };

    document.addEventListener('click', onClick, false);
    return () => document.removeEventListener('click', onClick, false);
  }, [beginLinkNavigation]);

  if (!loading || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483647] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.72)' }}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading page"
      data-nav-loading-overlay="true"
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-8 py-6 shadow-lg">
        <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
        <p className="text-sm font-medium text-muted-foreground">Loading…</p>
      </div>
    </div>,
    document.body,
  );
}
