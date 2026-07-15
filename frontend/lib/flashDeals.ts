export const FLASH_DEALS_ANCHOR = 'flash-deals';

export function flashDealsPagePath(locale: string, saleId?: string | null) {
  const base = `/${locale}/flash-deals`;
  return saleId ? `${base}?sale=${saleId}` : base;
}

export function flashDealsHomeAnchorPath(locale: string) {
  return `/${locale}#${FLASH_DEALS_ANCHOR}`;
}

export interface FlashSaleMeta {
  id: string;
  name: string;
  ends_at: string;
  starts_at?: string;
  banner_text?: string;
  banner_color?: string;
}

export interface FlashCampaign {
  sale: FlashSaleMeta;
  products: import('@/types').Product[];
}

export interface FlashPagePayload {
  mode: 'live' | 'upcoming' | 'empty';
  campaigns: FlashCampaign[];
  upcoming: FlashSaleMeta[];
  hasActive: boolean;
}

export interface FlashActivePayload {
  hasActive: boolean;
  activeCount: number;
  campaigns: FlashCampaign[];
  upcoming: FlashSaleMeta[];
  sale: FlashSaleMeta | null;
  products: import('@/types').Product[];
}

export function calcTimeLeft(endsAt: string) {
  const total = Math.max(0, new Date(endsAt).getTime() - Date.now());
  return {
    hours: Math.floor(total / 3_600_000),
    minutes: Math.floor((total % 3_600_000) / 60_000),
    seconds: Math.floor((total % 60_000) / 1_000),
    total,
  };
}

export type TimeLeft = ReturnType<typeof calcTimeLeft>;

export function calcTimeUntil(startsAt: string) {
  const total = Math.max(0, new Date(startsAt).getTime() - Date.now());
  return {
    days: Math.floor(total / 86_400_000),
    hours: Math.floor((total % 86_400_000) / 3_600_000),
    minutes: Math.floor((total % 3_600_000) / 60_000),
    seconds: Math.floor((total % 60_000) / 1_000),
    total,
  };
}
