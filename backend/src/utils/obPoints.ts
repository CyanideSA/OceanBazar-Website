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
 * Redemption packages (points → BDT):
 *   Bronze: 1000→10  | 5000→75   | 10000→180
 *   Silver: 1000→15  | 5000→100  | 10000→250
 *   Gold:   1000→20  | 5000→125  | 10000→300
 *
 * Points expire 365 days after earning if unused (checked on balance reads).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type OBTier = 'Bronze' | 'Silver' | 'Gold';

export interface RedemptionOption {
  points: RedemptionAmount;
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

export const REDEMPTION_TABLE: Record<OBTier, Record<number, number>> = {
  Bronze: { 1000: 10, 5000: 75, 10000: 180 },
  Silver: { 1000: 15, 5000: 100, 10000: 250 },
  Gold:   { 1000: 20, 5000: 125, 10000: 300 },
};

export const REDEMPTION_AMOUNTS = [1000, 5000, 10000] as const;
export type RedemptionAmount = (typeof REDEMPTION_AMOUNTS)[number];

export const POINTS_PER_BDT = 1;
export const POINTS_EXPIRY_DAYS = 365;

const TIER_PERKS: Record<OBTier, string[]> = {
  Bronze: ['Earn 1 OB per 1 BDT', 'Basic redemption rates'],
  Silver: ['Earn 1 OB per 1 BDT', 'Better redemption rates', 'Priority support'],
  Gold:   ['Earn 1 OB per 1 BDT', 'Best redemption rates', 'Priority support', 'Early access to deals', 'Free shipping on 500+ BDT'],
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

/** Check if a spend amount would trigger a tier upgrade. */
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

// ─── Redemption ───────────────────────────────────────────────────────────────

export function getRedemptionValue(tier: OBTier, points: number): number | null {
  return REDEMPTION_TABLE[tier][points] ?? null;
}

export function getRedemptionOptions(
  tier: OBTier,
  balance: number,
): RedemptionOption[] {
  return REDEMPTION_AMOUNTS.map((pts) => ({
    points: pts,
    bdtValue: REDEMPTION_TABLE[tier][pts],
    canRedeem: balance >= pts,
  }));
}

export function validateRedemption(
  tier: OBTier,
  balance: number,
  pointsToRedeem: number,
): RedemptionResult {
  if (!REDEMPTION_AMOUNTS.includes(pointsToRedeem as RedemptionAmount)) {
    return {
      valid: false,
      bdtValue: 0,
      error: `Invalid redemption amount. Choose from: ${REDEMPTION_AMOUNTS.join(', ')} OB.`,
    };
  }
  if (balance < pointsToRedeem) {
    return {
      valid: false,
      bdtValue: 0,
      error: `Insufficient OB Points. Have ${balance}, need ${pointsToRedeem}.`,
    };
  }
  const bdtValue = REDEMPTION_TABLE[tier][pointsToRedeem];
  return { valid: true, bdtValue };
}

/**
 * Given a max BDT discount the order can absorb, find the best redemption
 * package the user can afford that does not exceed the cap.
 * Returns null when no package fits.
 */
export function bestRedemptionForOrder(
  tier: OBTier,
  balance: number,
  maxBdtDiscount: number,
): { points: RedemptionAmount; bdtValue: number } | null {
  const options = getRedemptionOptions(tier, balance)
    .filter((o) => o.canRedeem && o.bdtValue <= maxBdtDiscount)
    .sort((a, b) => b.bdtValue - a.bdtValue);
  return options[0] ? { points: options[0].points, bdtValue: options[0].bdtValue } : null;
}

// ─── Expiry helper (pure date logic, caller runs the query) ───────────────────

export function pointsExpiryDate(earnedAt: Date): Date {
  const d = new Date(earnedAt);
  d.setDate(d.getDate() + POINTS_EXPIRY_DAYS);
  return d;
}

export function isPointsExpired(earnedAt: Date, now: Date = new Date()): boolean {
  return now > pointsExpiryDate(earnedAt);
}
