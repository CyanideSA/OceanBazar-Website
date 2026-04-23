package com.oceanbazar.backend.service;

import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class ObPointsRulesService {

    public enum OBTier { Bronze, Silver, Gold }

    public static final Map<OBTier, BigDecimal> TIER_THRESHOLDS = Map.of(
            OBTier.Bronze, BigDecimal.ZERO,
            OBTier.Silver, BigDecimal.valueOf(10_000),
            OBTier.Gold, BigDecimal.valueOf(50_000)
    );

    public static final Map<OBTier, Map<Integer, Integer>> REDEMPTION_TABLE = Map.of(
            OBTier.Bronze, Map.of(1000, 10, 5000, 75, 10000, 180),
            OBTier.Silver, Map.of(1000, 15, 5000, 100, 10000, 250),
            OBTier.Gold, Map.of(1000, 20, 5000, 125, 10000, 300)
    );

    public static final Set<Integer> REDEMPTION_AMOUNTS = Set.of(1000, 5000, 10000);
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

    public static class RedemptionResult {
        public boolean valid;
        public int bdtValue;
        public String error;
    }

    public RedemptionResult validateRedemption(OBTier tier, int balance, int pointsToRedeem) {
        RedemptionResult r = new RedemptionResult();
        if (!REDEMPTION_AMOUNTS.contains(pointsToRedeem)) {
            r.valid = false; r.error = "Invalid redemption amount. Choose from: 1000, 5000, 10000 OB."; return r;
        }
        if (balance < pointsToRedeem) {
            r.valid = false; r.error = "Insufficient OB Points. Have " + balance + ", need " + pointsToRedeem + "."; return r;
        }
        r.valid = true;
        r.bdtValue = REDEMPTION_TABLE.get(tier).getOrDefault(pointsToRedeem, 0);
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
