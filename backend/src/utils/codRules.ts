/**
 * Cash-on-Delivery eligibility rules — pure logic, no DB.
 *
 * COD is allowed when ALL conditions are met:
 *   1. Order total ≤ COD_LIMIT (5 000 BDT)
 *   2. User's account is not flagged for COD abuse
 *   3. No more than MAX_PENDING_COD pending COD orders at a time
 *   4. Shipping address is not in a COD-restricted district
 */

import { COD_LIMIT, round2 } from './pricing';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CodEligibilityInput {
  orderTotal: number;
  pendingCodCount: number;
  codAbuse: boolean;
  district: string;
}

export interface CodEligibilityResult {
  allowed: boolean;
  reasons: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const MAX_PENDING_COD = 3;

/** Districts where COD is not offered (remote / logistically hard). */
export const COD_RESTRICTED_DISTRICTS: ReadonlySet<string> = new Set([
  'bandarban',
  'rangamati',
  'khagrachhari',
]);

// ─── Logic ────────────────────────────────────────────────────────────────────

export function checkCodEligibility(input: CodEligibilityInput): CodEligibilityResult {
  const reasons: string[] = [];

  if (input.orderTotal > COD_LIMIT) {
    reasons.push(`COD is available for orders up to ${COD_LIMIT} BDT. Your total is ${round2(input.orderTotal)} BDT.`);
  }

  if (input.codAbuse) {
    reasons.push('COD is temporarily disabled on your account due to repeated cancellations.');
  }

  if (input.pendingCodCount >= MAX_PENDING_COD) {
    reasons.push(
      `You can have at most ${MAX_PENDING_COD} pending COD orders. Please receive or cancel an existing one first.`,
    );
  }

  const district = input.district.trim().toLowerCase();
  if (COD_RESTRICTED_DISTRICTS.has(district)) {
    reasons.push(`COD is not available in ${input.district}. Please choose an online payment method.`);
  }

  return { allowed: reasons.length === 0, reasons };
}
