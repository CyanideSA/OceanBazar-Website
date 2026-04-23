import type { OBTier } from '@/types';

export const TIER_THRESHOLDS = { Bronze: 0, Silver: 10_000, Gold: 50_000 } as const;

export const REDEMPTION_TABLE: Record<OBTier, Record<number, number>> = {
  Bronze: { 1000: 10, 5000: 75, 10000: 180 },
  Silver: { 1000: 15, 5000: 100, 10000: 250 },
  Gold: { 1000: 20, 5000: 125, 10000: 300 },
};

export const REDEMPTION_AMOUNTS = [1000, 5000, 10000] as const;

export function getTier(lifetimeSpend: number): OBTier {
  if (lifetimeSpend >= TIER_THRESHOLDS.Gold) return 'Gold';
  if (lifetimeSpend >= TIER_THRESHOLDS.Silver) return 'Silver';
  return 'Bronze';
}

export function getRedemptionValue(tier: OBTier, points: number): number | null {
  return REDEMPTION_TABLE[tier][points] ?? null;
}

export function getNextTierInfo(lifetimeSpend: number) {
  if (lifetimeSpend < TIER_THRESHOLDS.Silver) {
    return { nextTier: 'Silver' as OBTier, remaining: TIER_THRESHOLDS.Silver - lifetimeSpend };
  }
  if (lifetimeSpend < TIER_THRESHOLDS.Gold) {
    return { nextTier: 'Gold' as OBTier, remaining: TIER_THRESHOLDS.Gold - lifetimeSpend };
  }
  return null;
}

export const TIER_COLORS: Record<OBTier, { bg: string; text: string; border: string }> = {
  Bronze: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  Silver: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  Gold: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-400' },
};
