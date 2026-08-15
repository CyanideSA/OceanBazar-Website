/** Shared animation presets for hero slides + storefront popups (admin list-view). */
export const STOREFRONT_ANIMATIONS = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'fade-up', label: 'Fade up' },
  { value: 'fade-down', label: 'Fade down' },
  { value: 'fade-left', label: 'Fade left' },
  { value: 'fade-right', label: 'Fade right' },
  { value: 'zoom-in', label: 'Zoom in' },
  { value: 'zoom-out', label: 'Zoom out' },
  { value: 'slide-up', label: 'Slide up' },
  { value: 'slide-down', label: 'Slide down' },
  { value: 'slide-left', label: 'Slide left' },
  { value: 'slide-right', label: 'Slide right' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'flip', label: 'Flip' },
  { value: 'blur-in', label: 'Blur in' },
  { value: 'scale-spring', label: 'Scale spring' },
  { value: 'rotate-in', label: 'Rotate in' },
  { value: 'ken-burns', label: 'Ken Burns' },
] as const;

export type StorefrontAnimation = (typeof STOREFRONT_ANIMATIONS)[number]['value'];

export function isStorefrontAnimation(v: unknown): v is StorefrontAnimation {
  return STOREFRONT_ANIMATIONS.some((a) => a.value === v);
}

export function resolveAnimation(v: unknown, fallback: StorefrontAnimation = 'fade'): StorefrontAnimation {
  return isStorefrontAnimation(v) ? v : fallback;
}

/** Tailwind-ish class helpers used by Next storefront. */
export function popupAnimationClass(anim: StorefrontAnimation): string {
  switch (anim) {
    case 'none':
      return '';
    case 'fade-up':
    case 'slide-up':
      return 'animate-in fade-in slide-in-from-bottom-4 duration-300';
    case 'fade-down':
    case 'slide-down':
      return 'animate-in fade-in slide-in-from-top-4 duration-300';
    case 'fade-left':
    case 'slide-left':
      return 'animate-in fade-in slide-in-from-right-8 duration-300';
    case 'fade-right':
    case 'slide-right':
      return 'animate-in fade-in slide-in-from-left-8 duration-300';
    case 'zoom-out':
      return 'animate-in fade-in zoom-in-50 duration-300';
    case 'bounce':
      return 'animate-in fade-in zoom-in-95 duration-500';
    case 'flip':
      return 'animate-in fade-in zoom-in-90 duration-400';
    case 'blur-in':
      return 'animate-in fade-in duration-500';
    case 'scale-spring':
      return 'animate-in fade-in zoom-in-95 duration-500';
    case 'rotate-in':
      return 'animate-in fade-in zoom-in-90 duration-400';
    case 'ken-burns':
      return 'animate-in fade-in zoom-in-95 duration-700';
    case 'zoom-in':
      return 'animate-in fade-in zoom-in-95 duration-300';
    case 'fade':
    default:
      return 'animate-in fade-in duration-300';
  }
}

export type StorefrontPopup = {
  id: string;
  enabled?: boolean;
  type?: 'welcome' | 'promo' | 'custom' | string;
  title?: string;
  body?: string;
  imageUrl?: string;
  buttonLabel?: string;
  buttonAction?: 'link' | 'close' | string;
  buttonUrl?: string;
  buttonCloseMessage?: string;
  sortOrder?: number;
  animation?: string;
  showToLoggedIn?: boolean;
  dismissHours?: number;
  delayMs?: number;
};

export type AppDownloadSettings = {
  enabled?: boolean;
  androidUrl?: string;
  iosUrl?: string;
  windowsUrl?: string;
  macUrl?: string;
  bannerText?: string;
  animation?: string;
};

export type DevicePlatform = 'android' | 'ios' | 'windows' | 'mac' | 'other';

export function detectDevicePlatform(ua = ''): DevicePlatform {
  const s = ua.toLowerCase();
  if (/iphone|ipad|ipod/.test(s)) return 'ios';
  if (/android/.test(s)) return 'android';
  if (/windows/.test(s)) return 'windows';
  if (/macintosh|mac os x/.test(s) && !/iphone|ipad|ipod/.test(s)) return 'mac';
  return 'other';
}
