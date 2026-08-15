'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Download } from 'lucide-react';
import { storefrontApi } from '@/lib/api';
import {
  STOREFRONT_SETTINGS_QUERY_KEY,
  coalesceStorefrontSettings,
} from '@/lib/storefrontSettings';
import type { StorefrontPublicSettings } from '@/lib/fetchStorefrontCatalog';
import {
  detectDevicePlatform,
  popupAnimationClass,
  resolveAnimation,
  type AppDownloadSettings,
  type DevicePlatform,
} from '@/lib/storefrontMotion';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'ob_app_download_dismissed';

function platformMeta(platform: DevicePlatform, cfg: AppDownloadSettings) {
  if (platform === 'android') {
    return {
      label: 'Android',
      href: String(cfg.androidUrl || '').trim(),
      store: 'Play Store',
      icon: 'android',
      pwaFallback: !String(cfg.androidUrl || '').trim(),
    };
  }
  if (platform === 'ios') {
    return {
      label: 'iOS',
      href: String(cfg.iosUrl || '').trim(),
      store: 'App Store',
      icon: 'ios',
      pwaFallback: !String(cfg.iosUrl || '').trim(),
    };
  }
  if (platform === 'windows') {
    return {
      label: 'Windows',
      href: String(cfg.windowsUrl || '').trim(),
      store: 'Desktop',
      icon: 'windows',
      pwaFallback: !String(cfg.windowsUrl || '').trim(),
    };
  }
  if (platform === 'mac') {
    return {
      label: 'Mac',
      href: String(cfg.macUrl || '').trim(),
      store: 'Desktop',
      icon: 'mac',
      pwaFallback: !String(cfg.macUrl || '').trim(),
    };
  }
  return {
    label: 'App',
    href: String(cfg.androidUrl || cfg.iosUrl || '').trim(),
    store: 'Install',
    icon: 'web',
    pwaFallback: true,
  };
}

function DeviceIcon({ kind }: { kind: string }) {
  const common = 'h-5 w-5';
  if (kind === 'android') {
    return (
      <svg className={common} viewBox="0 0 24 24" aria-hidden>
        <path fill="currentColor" d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v7c0 .83.67 1.5 1.5 1.5S5 17.33 5 16.5v-7C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v7c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-7c0-.83-.67-1.5-1.5-1.5zm-4.97-5.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48A5.84 5.84 0 0 0 12 1c-.88 0-1.71.2-2.46.54L8.07.07c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.3 1.3C7.14 3.04 6 4.86 6 7h12c0-2.14-1.14-3.96-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z" />
      </svg>
    );
  }
  if (kind === 'ios') {
    return (
      <svg className={common} viewBox="0 0 24 24" aria-hidden>
        <path fill="currentColor" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.22-2 1.08-3.15-1.05.05-2.32.72-3.07 1.61-.66.78-1.24 2.03-1.08 3.22 1.14.09 2.31-.6 3.07-1.68" />
      </svg>
    );
  }
  if (kind === 'windows') {
    return (
      <svg className={common} viewBox="0 0 24 24" aria-hidden>
        <path fill="currentColor" d="M3 12V6.5l7-1V12H3zm0 1h7v6.5l-7-1V13zm8-7.4 10-1.4V12H11V5.6zm0 7.4h10v7.4l-10-1.4V13z" />
      </svg>
    );
  }
  if (kind === 'mac') {
    return (
      <svg className={common} viewBox="0 0 24 24" aria-hidden>
        <path fill="currentColor" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.22-2 1.08-3.15-1.05.05-2.32.72-3.07 1.61-.66.78-1.24 2.03-1.08 3.22 1.14.09 2.31-.6 3.07-1.68" />
      </svg>
    );
  }
  return <Download className={common} />;
}

export default function AppDownloadBanner({
  initialSettings,
}: {
  initialSettings?: StorefrontPublicSettings;
}) {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState<DevicePlatform>('other');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

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
  const cfg = (settings?.appDownload || {}) as AppDownloadSettings;

  useEffect(() => {
    if (cfg.enabled === false) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < 7 * 86400_000) return;
    setPlatform(detectDevicePlatform(navigator.userAgent));
    const t = window.setTimeout(() => setShow(true), 800);
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('beforeinstallprompt', onBip);
    };
  }, [cfg.enabled]);

  if (!show || cfg.enabled === false) return null;

  const meta = platformMeta(platform, cfg);
  const anim = resolveAnimation(cfg.animation, 'slide-down');

  async function onCta() {
    if (meta.href) {
      window.open(meta.href, '_blank', 'noopener,noreferrer');
      return;
    }
    // PWA / web-app installable fallback (Windows/Mac or empty store links)
    if (deferredPrompt?.prompt) {
      await deferredPrompt.prompt();
      setDeferredPrompt(null);
      setShow(false);
      return;
    }
    // iOS / unsupported: soft hint via alert-less dismissible state
    alert(
      platform === 'ios'
        ? 'Tap Share, then “Add to Home Screen” to install OceanBazar.'
        : 'Use your browser Install / Add to Home Screen option for the OceanBazar web app.',
    );
  }

  return (
    <div
      className={cn(
        'relative z-[60] w-full border-b border-cyan-400/30 bg-slate-950 text-white',
        popupAnimationClass(anim),
      )}
      data-ob-app-download-banner="1"
      data-ob-platform={platform}
      role="region"
      aria-label="App download"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2 sm:px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400 text-slate-950">
          <DeviceIcon kind={meta.icon} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold sm:text-sm">
            {cfg.bannerText || 'Get the OceanBazar app for a faster shopping experience'}
          </p>
          <p className="truncate text-[11px] text-blue-100/80">
            {meta.pwaFallback
              ? `${meta.label} · Installable web app`
              : `${meta.label} · ${meta.store}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onCta}
          className="shrink-0 rounded-full bg-cyan-400 px-3 py-1.5 text-xs font-bold text-slate-950"
        >
          {meta.pwaFallback ? 'Install' : 'Download'}
        </button>
        <button
          type="button"
          aria-label="Close"
          className="shrink-0 rounded-full p-1 text-blue-100/80 hover:bg-white/10 hover:text-white"
          onClick={() => {
            setShow(false);
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
