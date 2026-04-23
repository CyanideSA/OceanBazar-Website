package com.oceanbazar.backend.service;

import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Service
public class CodRulesService {

    public static final int MAX_PENDING_COD = 3;
    public static final Set<String> COD_RESTRICTED_DISTRICTS = Set.of("bandarban", "rangamati", "khagrachhari");

    public static class CodEligibilityResult {
        public boolean allowed;
        public List<String> reasons = new ArrayList<>();
    }

    public CodEligibilityResult check(BigDecimal orderTotal, int pendingCodCount, boolean codAbuse, String district) {
        CodEligibilityResult r = new CodEligibilityResult();

        if (orderTotal.compareTo(PricingService.COD_LIMIT) > 0) {
            r.reasons.add("COD is available for orders up to " + PricingService.COD_LIMIT + " BDT. Your total is " + PricingService.round2(orderTotal) + " BDT.");
        }
        if (codAbuse) {
            r.reasons.add("COD is temporarily disabled on your account due to repeated cancellations.");
        }
        if (pendingCodCount >= MAX_PENDING_COD) {
            r.reasons.add("You can have at most " + MAX_PENDING_COD + " pending COD orders.");
        }
        String d = district != null ? district.trim().toLowerCase() : "";
        if (COD_RESTRICTED_DISTRICTS.contains(d)) {
            r.reasons.add("COD is not available in " + district + ". Please choose an online payment method.");
        }

        r.allowed = r.reasons.isEmpty();
        return r;
    }
}
