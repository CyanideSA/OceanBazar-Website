import type { OBTier } from '@/types';

export const TIER_THRESHOLDS = { Bronze: 0, Silver: 10_000, Gold: 50_000 } as const;

export const SLAB_SIZE = 10_000;
export const SLAB_BASE_VALUE = 500;
export const SLAB_INCREMENT = 250;
export const MIN_REDEEMABLE_POINTS = 1000;

export function getTier(lifetimeSpend: number): OBTier {
  if (lifetimeSpend >= TIER_THRESHOLDS.Gold) return 'Gold';
  if (lifetimeSpend >= TIER_THRESHOLDS.Silver) return 'Silver';
  return 'Bronze';
}

/**
 * Cumulative slab redemption formula:
 *   Slab 1 (first 10k) = 500 BDT
 *   Slab 2 (next 10k)  = 750 BDT
 *   Slab N              = 500 + (N-1)*250
 *   Partial slab gets proportional value.
 */
export function calculateSlabRedemptionValue(points: number): number {
  if (points <= 0) return 0;
  const fullSlabs = Math.floor(points / SLAB_SIZE);
  const remainder = points % SLAB_SIZE;

  let total = 0;
  for (let i = 1; i <= fullSlabs; i++) {
    total += SLAB_BASE_VALUE + (i - 1) * SLAB_INCREMENT;
  }

  if (remainder > 0) {
    const nextSlabFull = SLAB_BASE_VALUE + fullSlabs * SLAB_INCREMENT;
    total += Math.round((remainder / SLAB_SIZE) * nextSlabFull);
  }

  return total;
}

/** @deprecated Use calculateSlabRedemptionValue */
export function getRedemptionValue(_tier: OBTier, points: number): number | null {
  if (points < MIN_REDEEMABLE_POINTS) return null;
  return calculateSlabRedemptionValue(points);
}

export function getRedemptionOptions(balance: number) {
  const amounts = [10_000, 20_000, 30_000, 50_000, 100_000];
  const options: { points: number; bdtValue: number; canRedeem: boolean }[] = [];

  for (const pts of amounts) {
    if (pts > balance * 2) break;
    options.push({
      points: pts,
      bdtValue: calculateSlabRedemptionValue(pts),
      canRedeem: balance >= pts,
    });
  }

  if (balance >= MIN_REDEEMABLE_POINTS && !options.some((o) => o.points === balance)) {
    options.push({
      points: balance,
      bdtValue: calculateSlabRedemptionValue(balance),
      canRedeem: true,
    });
    options.sort((a, b) => a.points - b.points);
  }

  return options;
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
  Bronze: {
    bg: 'bg-amber-100 dark:bg-amber-950/40',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-300 dark:border-amber-700/60',
  },
  Silver: {
    bg: 'bg-slate-100 dark:bg-slate-800/50',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-300 dark:border-slate-600/60',
  },
  Gold: {
    bg: 'bg-yellow-100 dark:bg-yellow-950/40',
    text: 'text-yellow-800 dark:text-yellow-300',
    border: 'border-yellow-400 dark:border-yellow-700/60',
  },
};
