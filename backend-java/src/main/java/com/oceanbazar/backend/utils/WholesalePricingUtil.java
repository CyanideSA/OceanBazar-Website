package com.oceanbazar.backend.utils;

import com.oceanbazar.backend.entity.ProductEntity;
import com.oceanbazar.backend.entity.ProductPricingEntity;
import com.oceanbazar.backend.entity.UserEntity;
import com.oceanbazar.backend.entity.enums.CustomerType;
import com.oceanbazar.backend.entity.enums.UserType;
import com.oceanbazar.backend.service.PricingService;

import java.math.BigDecimal;

/**
 * Pricing helpers using {@link ProductEntity#getPricing()} rows (retail / wholesale) and {@link PricingService}.
 */
public final class WholesalePricingUtil {
    private WholesalePricingUtil() {}

    public static final int RETAIL_MAX_ORDER_QTY = 25;
    public static final int WHOLESALE_VOLUME_MIN_QTY = 26;

    private static final int DEFAULT_BREAK_1 = 100;
    private static final int DEFAULT_BREAK_2 = 500;
    private static final int DEFAULT_BREAK_3 = 1000;

    private static final PricingService PRICING = new PricingService();

    public static boolean isApprovedWholesaleUser(UserEntity user) {
        if (user == null) return false;
        return user.getUserType() == UserType.wholesale;
    }

    public static ProductPricingEntity findPricing(ProductEntity product, CustomerType type) {
        if (product == null || product.getPricing() == null) return null;
        String typeName = type.name();
        return product.getPricing().stream()
                .filter(p -> typeName.equalsIgnoreCase(p.getCustomerType()))
                .findFirst()
                .orElse(null);
    }

    private static PricingService.PricingRow toRow(ProductPricingEntity pr) {
        if (pr == null) return null;
        PricingService.PricingRow row = new PricingService.PricingRow();
        row.price = pr.getPrice();
        row.compareAt = pr.getCompareAt();
        row.tier1MinQty = pr.getTier1MinQty();
        row.tier1Discount = pr.getTier1Discount();
        row.tier2MinQty = pr.getTier2MinQty();
        row.tier2Discount = pr.getTier2Discount();
        row.tier3MinQty = pr.getTier3MinQty();
        row.tier3Discount = pr.getTier3Discount();
        return row;
    }

    public static double getWholesaleBasePrice(ProductEntity product) {
        ProductPricingEntity w = findPricing(product, CustomerType.wholesale);
        if (w != null && w.getPrice() != null) {
            return w.getPrice().doubleValue();
        }
        ProductPricingEntity r = findPricing(product, CustomerType.retail);
        return r != null && r.getPrice() != null ? r.getPrice().doubleValue() : 0.0;
    }

    private static double getRetailBase(ProductEntity product) {
        ProductPricingEntity r = findPricing(product, CustomerType.retail);
        return r != null && r.getPrice() != null ? r.getPrice().doubleValue() : 0.0;
    }

    public static int[] resolveWholesaleBreaks(ProductEntity product) {
        ProductPricingEntity w = findPricing(product, CustomerType.wholesale);
        int b1 = w != null && w.getTier1MinQty() != null ? w.getTier1MinQty() : DEFAULT_BREAK_1;
        int b2 = w != null && w.getTier2MinQty() != null ? w.getTier2MinQty() : DEFAULT_BREAK_2;
        int b3 = w != null && w.getTier3MinQty() != null ? w.getTier3MinQty() : DEFAULT_BREAK_3;
        b1 = Math.max(WHOLESALE_VOLUME_MIN_QTY, b1);
        b2 = Math.max(b1, b2);
        b3 = Math.max(b2, b3);
        return new int[] { b1, b2, b3 };
    }

    public static double getWholesaleVolumeDiscountPct(ProductEntity product, int quantity) {
        if (quantity < WHOLESALE_VOLUME_MIN_QTY) return 0.0;
        int[] b = resolveWholesaleBreaks(product);
        int b1 = b[0];
        int b2 = b[1];
        int b3 = b[2];
        if (quantity <= b1) return 0.0;
        if (quantity <= b2) return 0.03;
        if (quantity <= b3) return 0.05;
        return 0.08;
    }

    public static double computeRetailUnitPrice(ProductEntity product, int quantity) {
        if (product == null) return 0.0;
        ProductPricingEntity retail = findPricing(product, CustomerType.retail);
        PricingService.PricingRow row = toRow(retail);
        if (row == null || row.price == null) return 0.0;
        int q = quantity <= 0 ? 1 : quantity;
        return PRICING.calculateRetailPrice(row, q).unitPrice.doubleValue();
    }

    public static double computeWholesaleUnitPrice(ProductEntity product, int quantity) {
        if (product == null) return 0.0;
        int q = quantity <= 0 ? 1 : quantity;
        ProductPricingEntity retailPr = findPricing(product, CustomerType.retail);
        ProductPricingEntity wholesalePr = findPricing(product, CustomerType.wholesale);
        PricingService.PricingRow retail = toRow(retailPr);
        PricingService.PricingRow wholesale = toRow(wholesalePr);
        if (retail == null || retail.price == null) return 0.0;
        int moq = product.getMoq() != null ? product.getMoq() : 1;
        if (wholesale == null || wholesale.price == null) {
            return PRICING.calculateRetailPrice(retail, q).unitPrice.doubleValue();
        }
        return PRICING.calculatePrice("wholesale", retail, wholesale, q, moq).unitPrice.doubleValue();
    }
}
