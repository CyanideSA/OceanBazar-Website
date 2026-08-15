'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { storefrontApi } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import {
  popupAnimationClass,
  resolveAnimation,
  type StorefrontPopup,
} from '@/lib/storefrontMotion';
import {
  STOREFRONT_SETTINGS_QUERY_KEY,
  coalesceStorefrontSettings,
} from '@/lib/storefrontSettings';
import type { StorefrontPublicSettings } from '@/lib/fetchStorefrontCatalog';

function dismissKey(id: string) {
  return `ob_popup_dismissed_${id}`;
}

function isDismissed(popup: StorefrontPopup): boolean {
  if (typeof window === 'undefined') return true;
  const raw = localStorage.getItem(dismissKey(popup.id));
  if (!raw) return false;
  const hours = Number(popup.dismissHours ?? 24);
  if (!Number.isFinite(hours) || hours <= 0) return true;
  return Date.now() - Number(raw) < hours * 3600_000;
}

function normalizePopups(raw: unknown): StorefrontPopup[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => p && typeof p === 'object')
    .map((p, i) => {
      const row = p as StorefrontPopup;
      return {
        ...row,
        id: String(row.id || `popup-${i}`),
        enabled: row.enabled !== false,
        sortOrder: Number(row.sortOrder ?? i),
      };
    })
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function localizeUrl(url: string, locale: string): string {
  if (!url) return `/${locale}/products`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/en/') || url.startsWith('/bn/')) return url;
  if (url.startsWith('/')) return `/${locale}${url}`;
  return url;
}

export default function StorefrontPopups({
  initialSettings,
}: {
  initialSettings?: StorefrontPublicSettings;
}) {
  const locale = useLocale();
  const user = useAuthStore((s) => s.user);
  const loggedIn = Boolean(user);
  const [queue, setQueue] = useState<StorefrontPopup[]>([]);
  const [active, setActive] = useState<StorefrontPopup | null>(null);

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

  const popups = useMemo(
    () => normalizePopups(settings?.storefrontPopups),
    [settings?.storefrontPopups],
  );

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_E2E_DISABLE_POPUPS === '1') return;
    if (typeof window !== 'undefined' && window.localStorage.getItem('ob_e2e_disable_popups') === '1') {
      return;
    }

    const eligible = popups.filter((p) => {
      if (!p.enabled) return false;
      if (isDismissed(p)) return false;
      // Welcome (and any popup with showToLoggedIn=false) hidden for logged-in sessions
      if (loggedIn) {
        if (p.type === 'welcome') return false;
        if (p.showToLoggedIn === false) return false;
      }
      return true;
    });

    setQueue(eligible);
    setActive(null);

    if (!eligible.length) return;
    const first = eligible[0];
    const delay = Math.max(0, Number(first.delayMs) || 1200);
    const t = window.setTimeout(() => setActive(first), delay);
    return () => window.clearTimeout(t);
  }, [popups, loggedIn]);

  function dismiss(current: StorefrontPopup) {
    localStorage.setItem(dismissKey(current.id), String(Date.now()));
    const rest = queue.filter((p) => p.id !== current.id);
    setQueue(rest);
    setActive(null);
    if (rest.length) {
      const next = rest[0];
      const delay = Math.max(200, Number(next.delayMs) || 600);
      window.setTimeout(() => setActive(next), delay);
    }
  }

  if (!active) return null;

  const anim = resolveAnimation(active.animation, 'zoom-in');
  const btnLabel =
    active.buttonAction === 'close'
      ? active.buttonCloseMessage || active.buttonLabel || 'Close'
      : active.buttonLabel || 'Continue';
  const href =
    active.buttonAction === 'link'
      ? localizeUrl(String(active.buttonUrl || `/${locale}/products`), locale)
      : null;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={() => dismiss(active)}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={active.title || 'OceanBazar'}
        className={cn(
          'fixed left-1/2 top-1/2 z-[101] w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl',
          popupAnimationClass(anim),
        )}
        data-ob-popup-id={active.id}
        data-ob-popup-type={active.type || 'custom'}
      >
        <button
          type="button"
          onClick={() => dismiss(active)}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {active.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={active.imageUrl}
            alt={active.title || ''}
            className="h-auto w-full object-contain bg-card"
          />
        ) : null}

        <div className="space-y-3 px-6 py-5">
          {active.title ? <h2 className="text-center text-xl font-bold">{active.title}</h2> : null}
          {active.body ? (
            <p className="text-center text-sm text-muted-foreground whitespace-pre-wrap">{active.body}</p>
          ) : null}

          {href ? (
            <a
              href={href}
              onClick={() => dismiss(active)}
              className="flex w-full items-center justify-center rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground"
            >
              {btnLabel}
            </a>
          ) : (
            <button
              type="button"
              onClick={() => dismiss(active)}
              className="flex w-full items-center justify-center rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground"
            >
              {btnLabel}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
