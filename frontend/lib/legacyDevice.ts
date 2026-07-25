import { isIosWebKit } from '@/lib/iosSafari';

/**
 * Older / low-memory phones where full-screen nav overlays and heavy eager
 * client chunks (framer-motion, firebase) tend to block hydration or clicks.
 */
export function isLegacyStorefrontDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (isIosWebKit()) {
    const m = navigator.userAgent.match(/OS (\d+)_/);
    const major = m ? Number(m[1]) : 0;
    // iPhone 7 maxes at iOS 15.x
    if (major > 0 && major <= 15) return true;
  }
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof mem === 'number' && mem <= 4) return true;
  const cores = navigator.hardwareConcurrency;
  if (typeof cores === 'number' && cores > 0 && cores <= 4) return true;
  return false;
}
