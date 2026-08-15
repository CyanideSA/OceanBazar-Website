'use client';

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  startTransition,
  type ReactNode,
} from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { routeKeyFromLocation } from '@/lib/navigationRouteKey';

type ProgrammaticPending = {
  targetKey: string;
  settle?: () => Promise<void>;
};

export type NavigationLoadingContextValue = {
  loading: boolean;
  /** Internal: link tap started navigation (pointerdown on <a>). */
  beginLinkNavigation: () => void;
  /** Programmatic navigation with overlay until route + optional settle (e.g. data fetch). */
  pushWithLoading: (href: string, opts?: { settle?: () => Promise<void> }) => void;
};

export const NavigationLoadingContext = createContext<NavigationLoadingContextValue | null>(null);

const STATIC_NAV_LOADING: NavigationLoadingContextValue = {
  loading: false,
  beginLinkNavigation: () => {},
  pushWithLoading: () => {},
};

function NavigationLoadingProviderInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? '';
  const routeKey = routeKeyFromLocation(pathname, search);

  const [loading, setLoading] = useState(false);
  const prevRouteKey = useRef<string | null>(null);
  const programmaticRef = useRef<ProgrammaticPending | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const clearLoadingTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scheduleLoadingTimeout = useCallback(() => {
    clearLoadingTimeout();
    // Safety valve: if navigation stalls (network/webview issues), don't trap UI forever.
    timeoutRef.current = window.setTimeout(() => {
      programmaticRef.current = null;
      setLoading(false);
      timeoutRef.current = null;
    }, 4000);
  }, [clearLoadingTimeout]);

  useEffect(() => {
    const onPop = () => {
      programmaticRef.current = null;
      clearLoadingTimeout();
      setLoading(false);
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      clearLoadingTimeout();
    };
  }, [clearLoadingTimeout]);

  useEffect(() => {
    if (prevRouteKey.current === null) {
      prevRouteKey.current = routeKey;
      return;
    }
    if (prevRouteKey.current === routeKey) return;

    const prog = programmaticRef.current;
    if (prog) {
      if (routeKey === prog.targetKey) {
        programmaticRef.current = null;
        void (async () => {
          try {
            if (prog.settle) await prog.settle();
            else {
              await new Promise<void>((r) =>
                requestAnimationFrame(() => requestAnimationFrame(() => r())),
              );
              await new Promise((r) => setTimeout(r, 32));
            }
          } finally {
            clearLoadingTimeout();
            setLoading(false);
          }
        })();
      } else {
        programmaticRef.current = null;
        clearLoadingTimeout();
        setLoading(false);
      }
      prevRouteKey.current = routeKey;
      return;
    }

    clearLoadingTimeout();
    setLoading(false);
    prevRouteKey.current = routeKey;
  }, [clearLoadingTimeout, routeKey]);

  const beginLinkNavigation = useCallback(() => {
    setLoading(true);
    scheduleLoadingTimeout();
  }, [scheduleLoadingTimeout]);

  const pushWithLoading = useCallback(
    (href: string, opts?: { settle?: () => Promise<void> }) => {
      if (typeof window === 'undefined') return;
      let url: URL;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }
      const targetKey = routeKeyFromLocation(url.pathname, url.searchParams.toString());
      programmaticRef.current = { targetKey, settle: opts?.settle };
      setLoading(true);
      scheduleLoadingTimeout();
      startTransition(() => {
        router.push(href);
      });
    },
    [router, scheduleLoadingTimeout],
  );

  const value: NavigationLoadingContextValue = {
    loading,
    beginLinkNavigation,
    pushWithLoading,
  };

  return (
    <NavigationLoadingContext.Provider value={value}>{children}</NavigationLoadingContext.Provider>
  );
}

/** Suspense boundary required for static export: inner hooks read `useSearchParams`. */
export function NavigationLoadingProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <NavigationLoadingContext.Provider value={STATIC_NAV_LOADING}>{children}</NavigationLoadingContext.Provider>
      }
    >
      <NavigationLoadingProviderInner>{children}</NavigationLoadingProviderInner>
    </Suspense>
  );
}

export function useNavigationLoadingContext(): NavigationLoadingContextValue | null {
  return useContext(NavigationLoadingContext);
}
