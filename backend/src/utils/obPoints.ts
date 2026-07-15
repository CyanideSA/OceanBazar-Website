/**
 * OB Points System — pure logic, no DB.
 *
 * Earning:  1 OB Point per 1 BDT of order value (floor)
 *
 * Tiers (by users.lifetime_spend):
 *   Bronze  <  10,000 BDT
 *   Silver  >= 10,000 BDT
 *   Gold    >= 50,000 BDT
 *
 * Cumulative slab redemption formula (replaces old fixed-package model):
 *   Every 10,000 OB points forms one slab.
 *   Slab 1 (first 10k)  = 500 BDT
 *   Slab 2 (next 10k)   = 750 BDT (+250 more than previous)
 *   Slab 3 (next 10k)   = 1000 BDT (+250 more)
 *   Slab N               = 500 + (N-1)*250  BDT
 *   Total for N slabs   = sum(500 + (i-1)*250, i=1..N) = N*500 + 250*N*(N-1)/2
 *
 *   Partial slab (remainder < 10k) earns proportional value.
 *
 * Points expire 365 days after earning if unused.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type OBTier = 'Bronze' | 'Silver' | 'Gold';

export interface RedemptionOption {
  points: number;
  bdtValue: number;
  canRedeem: boolean;
}

export interface RedemptionResult {
  valid: boolean;
  bdtValue: number;
  error?: string;
}

export interface TierInfo {
  tier: OBTier;
  lifetimeSpend: number;
  nextTier: OBTier | null;
  spendToNextTier: number;
  perks: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const TIER_THRESHOLDS: Record<OBTier, number> = {
  Bronze: 0,
  Silver: 10_000,
  Gold: 50_000,
} as const;

export const SLAB_SIZE = 10_000;
export const SLAB_BASE_VALUE = 500;
export const SLAB_INCREMENT = 250;

export const POINTS_PER_BDT = 1;
export const POINTS_EXPIRY_DAYS = 365;
export const MIN_REDEEMABLE_POINTS = 1000;

const TIER_PERKS: Record<OBTier, string[]> = {
  Bronze: ['Earn 1 OB per 1 BDT', 'Cumulative slab redemption'],
  Silver: ['Earn 1 OB per 1 BDT', 'Cumulative slab redemption', 'Priority support'],
  Gold:   ['Earn 1 OB per 1 BDT', 'Cumulative slab redemption', 'Priority support', 'Early access to deals', 'Free shipping + no service charge on 5000+ BDT'],
};

// ─── Tier resolution ──────────────────────────────────────────────────────────

export function getTier(lifetimeSpend: number): OBTier {
  if (lifetimeSpend >= TIER_THRESHOLDS.Gold) return 'Gold';
  if (lifetimeSpend >= TIER_THRESHOLDS.Silver) return 'Silver';
  return 'Bronze';
}

export function getTierInfo(lifetimeSpend: number): TierInfo {
  const tier = getTier(lifetimeSpend);

  let nextTier: OBTier | null = null;
  let spendToNextTier = 0;

  if (tier === 'Bronze') {
    nextTier = 'Silver';
    spendToNextTier = Math.max(0, TIER_THRESHOLDS.Silver - lifetimeSpend);
  } else if (tier === 'Silver') {
    nextTier = 'Gold';
    spendToNextTier = Math.max(0, TIER_THRESHOLDS.Gold - lifetimeSpend);
  }

  return {
    tier,
    lifetimeSpend,
    nextTier,
    spendToNextTier,
    perks: TIER_PERKS[tier],
  };
}

export function wouldUpgradeTier(
  currentLifetimeSpend: number,
  additionalSpend: number,
): { upgrades: boolean; from: OBTier; to: OBTier } {
  const from = getTier(currentLifetimeSpend);
  const to = getTier(currentLifetimeSpend + additionalSpend);
  return { upgrades: from !== to, from, to };
}

// ─── Earning ──────────────────────────────────────────────────────────────────

export function calculatePointsEarned(orderTotal: number): number {
  if (orderTotal <= 0) return 0;
  return Math.floor(orderTotal * POINTS_PER_BDT);
}

// ─── Cumulative Slab Redemption ───────────────────────────────────────────────

/**
 * Calculate BDT value for a single slab (1-indexed).
 * Slab 1 = 500, Slab 2 = 750, Slab 3 = 1000, ...
 */
export function slabValue(slabIndex: number): number {
  return SLAB_BASE_VALUE + (slabIndex - 1) * SLAB_INCREMENT;
}

/**
 * Calculate total BDT discount for a given number of OB points.
 * Full slabs get full value; partial slab gets proportional value.
 *
 * 10,000 → 500
 * 20,000 → 500 + 750 = 1,250
 * 30,000 → 500 + 750 + 1,000 = 2,250
 * 15,000 → 500 + (5000/10000)*750 = 500 + 375 = 875
 */
export function calculateSlabRedemptionValue(points: number): number {
  if (points <= 0) return 0;
  const fullSlabs = Math.floor(points / SLAB_SIZE);
  const remainder = points % SLAB_SIZE;

  let total = 0;
  for (let i = 1; i <= fullSlabs; i++) {
    total += slabValue(i);
  }

  if (remainder > 0) {
    const nextSlabFull = slabValue(fullSlabs + 1);
    total += Math.round((remainder / SLAB_SIZE) * nextSlabFull);
  }

  return total;
}

/**
 * Build preview options showing BDT value at key point amounts.
 */
export function getRedemptionOptions(
  _tier: OBTier,
  balance: number,
): RedemptionOption[] {
  const amounts = [10_000, 20_000, 30_000, 50_000, 100_000];
  const options: RedemptionOption[] = [];

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

export function validateRedemption(
  _tier: OBTier,
  balance: number,
  pointsToRedeem: number,
): RedemptionResult {
  if (pointsToRedeem < MIN_REDEEMABLE_POINTS) {
    return {
      valid: false,
      bdtValue: 0,
      error: `Minimum ${MIN_REDEEMABLE_POINTS} OB Points required for redemption.`,
    };
  }
  if (balance < pointsToRedeem) {
    return {
      valid: false,
      bdtValue: 0,
      error: `Insufficient OB Points. Have ${balance}, need ${pointsToRedeem}.`,
    };
  }
  const bdtValue = calculateSlabRedemptionValue(pointsToRedeem);
  return { valid: true, bdtValue };
}

export function bestRedemptionForOrder(
  tier: OBTier,
  balance: number,
  maxBdtDiscount: number,
): { points: number; bdtValue: number } | null {
  if (balance < MIN_REDEEMABLE_POINTS) return null;

  let best: { points: number; bdtValue: number } | null = null;
  const step = SLAB_SIZE;
  for (let pts = step; pts <= balance; pts += step) {
    const val = calculateSlabRedemptionValue(pts);
    if (val <= maxBdtDiscount) {
      best = { points: pts, bdtValue: val };
    } else {
      break;
    }
  }
  // also check using full balance
  if (balance >= MIN_REDEEMABLE_POINTS) {
    const fullVal = calculateSlabRedemptionValue(balance);
    if (fullVal <= maxBdtDiscount) {
      if (!best || fullVal > best.bdtValue) {
        best = { points: balance, bdtValue: fullVal };
      }
    }
  }
  return best;
}

// ─── Legacy compatibility aliases ─────────────────────────────────────────────
/** @deprecated Use calculateSlabRedemptionValue instead */
export function getRedemptionValue(_tier: OBTier, points: number): number | null {
  if (points < MIN_REDEEMABLE_POINTS) return null;
  return calculateSlabRedemptionValue(points);
}

// ─── Expiry helper ────────────────────────────────────────────────────────────

export function pointsExpiryDate(earnedAt: Date): Date {
  const d = new Date(earnedAt);
  d.setDate(d.getDate() + POINTS_EXPIRY_DAYS);
  return d;
}

export function isPointsExpired(earnedAt: Date, now: Date = new Date()): boolean {
  return now > pointsExpiryDate(earnedAt);
}
