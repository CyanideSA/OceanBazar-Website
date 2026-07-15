'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Download, Share2 } from 'lucide-react';
import { trackPwaEvent } from '@/lib/pwaAnalytics';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * PWA Install Prompt Banner
 * Shows a sleek "Add to Home Screen" prompt when the browser fires
 * the beforeinstallprompt event (Chrome/Edge/Samsung on Android).
 * Also handles iOS Safari which requires manual Share → Add to Home Screen.
 */
export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // Don't show if dismissed within last 7 days
    const lastDismissed = localStorage.getItem('pwa_dismissed_at');
    if (lastDismissed && Date.now() - Number(lastDismissed) < 7 * 86400_000) return;

    // iOS detection
    const ua = navigator.userAgent;
    const isIosBrowser = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream;
    const isSafari = /safari/i.test(ua) && !/chrome/i.test(ua);
    if (isIosBrowser && isSafari) {
      setIsIos(true);
      // Show after 3s delay on iOS
      const t = setTimeout(() => {
        setShow(true);
        trackPwaEvent('pwa_install_banner_shown', { platform: 'ios_safari' });
      }, 3000);
      return () => clearTimeout(t);
    }

    // Chrome/Edge/Android
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      trackPwaEvent('pwa_beforeinstallprompt');
      // Show banner after 5s delay (don't interrupt browsing immediately)
      setTimeout(() => {
        setShow(true);
        trackPwaEvent('pwa_install_banner_shown', { platform: 'chromium' });
      }, 5000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    trackPwaEvent('pwa_native_install_prompt', { outcome });
    if (outcome === 'accepted') {
      setShow(false);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShow(false);
    setDismissed(true);
    localStorage.setItem('pwa_dismissed_at', String(Date.now()));
    trackPwaEvent('pwa_install_banner_dismissed', { platform: isIos ? 'ios_safari' : 'chromium' });
  }, [isIos]);

  if (!show || dismissed) return null;

  return (
    <div
      className="fixed bottom-4 left-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-border/60 bg-card/95 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300"
      role="dialog"
      aria-label="Install Oceanbazar app"
    >
      <div className="flex items-start gap-3 p-4">
        {/* App icon */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg">
          <span className="text-xl">🌊</span>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Install Oceanbazar</p>
          {isIos ? (
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              Tap <Share2 className="inline h-3 w-3 mx-0.5 text-primary" /> then{' '}
              <strong>"Add to Home Screen"</strong> for the best experience
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Fast, offline-ready app — no Play Store needed
            </p>
          )}
        </div>

        {/* Close */}
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Action buttons (only for non-iOS where we can trigger native prompt) */}
      {!isIos && (
        <div className="flex gap-2 border-t border-border/40 px-4 py-3">
          <button
            onClick={handleDismiss}
            className="flex-1 rounded-lg border border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            Not now
          </button>
          <button
            onClick={handleInstall}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.98]"
          >
            <Download className="h-3.5 w-3.5" />
            Install app
          </button>
        </div>
      )}
    </div>
  );
}
