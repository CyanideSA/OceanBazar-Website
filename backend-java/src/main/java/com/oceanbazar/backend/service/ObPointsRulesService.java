package com.oceanbazar.backend.service;

import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * OB Points rules — must stay in sync with backend/src/utils/obPoints.ts
 * Cumulative slab redemption (not the old fixed 1000/5000/10000 packages).
 */
@Service
public class ObPointsRulesService {

    public enum OBTier { Bronze, Silver, Gold }

    public static final Map<OBTier, BigDecimal> TIER_THRESHOLDS = Map.of(
            OBTier.Bronze, BigDecimal.ZERO,
            OBTier.Silver, BigDecimal.valueOf(10_000),
            OBTier.Gold, BigDecimal.valueOf(50_000)
    );

    public static final int SLAB_SIZE = 10_000;
    public static final int SLAB_BASE_VALUE = 500;
    public static final int SLAB_INCREMENT = 250;
    public static final int MIN_REDEEMABLE_POINTS = 1000;
    public static final int POINTS_EXPIRY_DAYS = 365;

    public OBTier getTier(BigDecimal lifetimeSpend) {
        if (lifetimeSpend.compareTo(TIER_THRESHOLDS.get(OBTier.Gold)) >= 0) return OBTier.Gold;
        if (lifetimeSpend.compareTo(TIER_THRESHOLDS.get(OBTier.Silver)) >= 0) return OBTier.Silver;
        return OBTier.Bronze;
    }

    public int calculatePointsEarned(BigDecimal orderTotal) {
        if (orderTotal.compareTo(BigDecimal.ZERO) <= 0) return 0;
        return orderTotal.intValue();
    }

    /** Slab 1 = 500, Slab 2 = 750, Slab 3 = 1000, ... */
    public int slabValue(int slabIndex) {
        return SLAB_BASE_VALUE + (slabIndex - 1) * SLAB_INCREMENT;
    }

    /** Full slabs + proportional remainder — matches Node calculateSlabRedemptionValue. */
    public int calculateSlabRedemptionValue(int points) {
        if (points <= 0) return 0;
        int fullSlabs = points / SLAB_SIZE;
        int remainder = points % SLAB_SIZE;
        int total = 0;
        for (int i = 1; i <= fullSlabs; i++) {
            total += slabValue(i);
        }
        if (remainder > 0) {
            int nextSlabFull = slabValue(fullSlabs + 1);
            total += (int) Math.round((remainder / (double) SLAB_SIZE) * nextSlabFull);
        }
        return total;
    }

    public static class RedemptionResult {
        public boolean valid;
        public int bdtValue;
        public String error;
    }

    public RedemptionResult validateRedemption(OBTier tier, int balance, int pointsToRedeem) {
        RedemptionResult r = new RedemptionResult();
        if (pointsToRedeem < MIN_REDEEMABLE_POINTS) {
            r.valid = false;
            r.error = "Minimum " + MIN_REDEEMABLE_POINTS + " OB Points required for redemption.";
            return r;
        }
        if (balance < pointsToRedeem) {
            r.valid = false;
            r.error = "Insufficient OB Points. Have " + balance + ", need " + pointsToRedeem + ".";
            return r;
        }
        r.valid = true;
        r.bdtValue = calculateSlabRedemptionValue(pointsToRedeem);
        return r;
    }

    public static class TierUpgradeResult {
        public boolean upgrades;
        public OBTier from;
        public OBTier to;
    }

    public TierUpgradeResult wouldUpgradeTier(BigDecimal currentLifetimeSpend, BigDecimal additionalSpend) {
        TierUpgradeResult r = new TierUpgradeResult();
        r.from = getTier(currentLifetimeSpend);
        r.to = getTier(currentLifetimeSpend.add(additionalSpend));
        r.upgrades = r.from != r.to;
        return r;
    }

    public boolean isExpired(Instant earnedAt) {
        return Instant.now().isAfter(earnedAt.plus(POINTS_EXPIRY_DAYS, ChronoUnit.DAYS));
    }
}
