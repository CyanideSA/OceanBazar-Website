'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useContext, useMemo } from 'react';
import { NavigationLoadingContext } from '@/components/shared/NavigationLoadingContext';

type PushOptions = { scroll?: boolean; settle?: () => Promise<void> };

/**
 * Shop shell router: `push` shows the global nav overlay until the route settles
 * (and optional `settle` completes). Outside NavigationLoadingProvider, delegates to Next.js.
 */
export function useShopRouter() {
  const router = useRouter();
  const ctx = useContext(NavigationLoadingContext);

  const push = useCallback(
    (href: string, options?: PushOptions) => {
      if (ctx) {
        ctx.pushWithLoading(href, { settle: options?.settle });
        return;
      }
      void router.push(href, options);
    },
    [ctx, router],
  );

  const pushWithLoading = useCallback(
    (href: string, opts?: { settle?: () => Promise<void> }) => {
      if (ctx) ctx.pushWithLoading(href, opts);
      else void router.push(href);
    },
    [ctx, router],
  );

  return useMemo(
    () => ({
      back: router.back,
      forward: router.forward,
      refresh: router.refresh,
      replace: router.replace,
      prefetch: router.prefetch,
      push,
      pushWithLoading,
    }),
    [router, push, pushWithLoading],
  );
}
