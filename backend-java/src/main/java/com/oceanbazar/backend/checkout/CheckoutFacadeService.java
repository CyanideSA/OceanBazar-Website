package com.oceanbazar.backend.checkout;

import com.oceanbazar.backend.entity.CartEntity;
import com.oceanbazar.backend.entity.CartItemEntity;
import com.oceanbazar.backend.entity.CouponEntity;
import com.oceanbazar.backend.entity.ProductEntity;
import com.oceanbazar.backend.entity.ProductPricingEntity;
import com.oceanbazar.backend.entity.SavedAddressEntity;
import com.oceanbazar.backend.entity.UserEntity;
import com.oceanbazar.backend.entity.enums.CustomerType;
import com.oceanbazar.backend.entity.enums.OrderStatus;
import com.oceanbazar.backend.repository.CartRepository;
import com.oceanbazar.backend.repository.ProductRepository;
import com.oceanbazar.backend.repository.CouponRepository;
import com.oceanbazar.backend.repository.OrderRepository;
import com.oceanbazar.backend.repository.SavedAddressRepository;
import com.oceanbazar.backend.repository.UserRepository;
import com.oceanbazar.backend.service.CheckoutValidationService;
import com.oceanbazar.backend.service.PricingService;
import com.oceanbazar.backend.utils.WholesalePricingUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CheckoutFacadeService {

    private final CartRepository cartRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final SavedAddressRepository savedAddressRepository;
    private final CouponRepository couponRepository;
    private final OrderRepository orderRepository;
    private final CheckoutValidationService checkoutValidationService;

    public Map<String, Object> validateCheckout(String userId, CheckoutValidateRequest request) {
        if (userId == null || userId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }

        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        CartEntity cart = cartRepository.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cart is empty"));

        List<CartItemEntity> cartItems = cart.getItems() == null ? List.of() : cart.getItems();
        if (cartItems.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cart is empty");
        }

        String userType = WholesalePricingUtil.isApprovedWholesaleUser(user)
                ? CustomerType.wholesale.name()
                : CustomerType.retail.name();

        CheckoutValidationService.CheckoutInput input = new CheckoutValidationService.CheckoutInput();
        input.userType = userType;
        input.paymentMethod = request.paymentMethod();
        input.obPointsToRedeem = request.obPointsToRedeem() != null ? request.obPointsToRedeem() : 0;
        input.obBalance = request.obBalance() != null ? request.obBalance() : 0;
        input.lifetimeSpend = user.getLifetimeSpend() != null ? user.getLifetimeSpend() : BigDecimal.ZERO;
        input.pendingCodCount = countPendingCod(userId);
        input.codAbuse = false;
        input.district = resolveDistrict(userId, request.shippingAddressId());

        if (request.couponCode() != null && !request.couponCode().isBlank()) {
            CouponEntity coupon = couponRepository.findByCode(request.couponCode().trim().toUpperCase()).orElse(null);
            input.coupon = coupon;
        }

        input.items = new ArrayList<>();
        for (CartItemEntity item : cartItems) {
            if (item == null || item.getProductId() == null) continue;
            ProductEntity product = productRepository.findById(item.getProductId()).orElse(null);
            if (product == null) continue;

            CheckoutValidationService.CheckoutLineItem line = new CheckoutValidationService.CheckoutLineItem();
            line.productId = item.getProductId();
            line.variantId = item.getVariantId();
            line.productTitle = product.getTitleEn() != null ? product.getTitleEn() : product.getId();
            line.quantity = item.getQuantity() != null ? item.getQuantity() : 0;
            line.stock = product.getStock() != null ? product.getStock() : 0;
            line.moq = product.getMoq() != null ? product.getMoq() : 1;
            line.retailPricing = toPricingRow(findPricing(product, CustomerType.retail));
            line.wholesalePricing = toPricingRow(findPricing(product, CustomerType.wholesale));
            input.items.add(line);
        }

        CheckoutValidationService.CheckoutResult result = checkoutValidationService.validate(input);
        return toResponse(result);
    }

    private int countPendingCod(String userId) {
        return (int) orderRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .filter(o -> o.getPaymentMethod() == com.oceanbazar.backend.entity.enums.PaymentMethod.cod)
                .filter(o -> {
                    OrderStatus s = o.getStatus();
                    return s == OrderStatus.pending || s == OrderStatus.confirmed || s == OrderStatus.processing;
                })
                .count();
    }

    private String resolveDistrict(String userId, Integer addressId) {
        if (addressId == null) return null;
        return savedAddressRepository.findById(addressId)
                .filter(a -> userId.equals(a.getUserId()))
                .map(SavedAddressEntity::getDistrict)
                .orElse(null);
    }

    private static ProductPricingEntity findPricing(ProductEntity product, CustomerType type) {
        if (product.getPricing() == null) return null;
        return product.getPricing().stream()
                .filter(p -> type.name().equalsIgnoreCase(p.getCustomerType()))
                .findFirst()
                .orElse(null);
    }

    private static PricingService.PricingRow toPricingRow(ProductPricingEntity pr) {
        if (pr == null) return null;
        PricingService.PricingRow row = new PricingService.PricingRow();
        row.price = pr.getPrice() != null ? pr.getPrice() : BigDecimal.ZERO;
        row.compareAt = pr.getCompareAt();
        row.tier1MinQty = pr.getTier1MinQty();
        row.tier1Discount = pr.getTier1Discount();
        row.tier2MinQty = pr.getTier2MinQty();
        row.tier2Discount = pr.getTier2Discount();
        row.tier3MinQty = pr.getTier3MinQty();
        row.tier3Discount = pr.getTier3Discount();
        row.tierBands = pr.getTierBands();
        return row;
    }

    private static Map<String, Object> toResponse(CheckoutValidationService.CheckoutResult result) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("valid", result.valid);
        body.put("errors", result.errors);
        body.put("couponDiscount", result.couponDiscount);
        body.put("freeShipping", result.freeShipping);
        body.put("obDiscount", result.obDiscount);
        body.put("obPointsEarned", result.obPointsEarned);
        body.put("codAllowed", result.codAllowed);

        List<Map<String, Object>> lines = new ArrayList<>();
        if (result.lines != null) {
            for (CheckoutValidationService.CheckoutLineResult line : result.lines) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("productId", line.productId);
                m.put("variantId", line.variantId);
                m.put("productTitle", line.productTitle);
                m.put("quantity", line.quantity);
                m.put("unitPrice", line.unitPrice);
                m.put("lineTotal", line.lineTotal);
                m.put("discountPct", line.discountPct);
                m.put("tierApplied", line.tierApplied);
                lines.add(m);
            }
        }
        body.put("lines", lines);

        if (result.totals != null) {
            Map<String, Object> totals = new LinkedHashMap<>();
            totals.put("subtotal", result.totals.subtotal);
            totals.put("discount", result.totals.discount);
            totals.put("gst", result.totals.gst);
            totals.put("shippingFee", result.totals.shippingFee);
            totals.put("serviceFee", result.totals.serviceFee);
            totals.put("obDiscount", result.totals.obDiscount);
            totals.put("total", result.totals.total);
            body.put("totals", totals);
        }
        return body;
    }

    public record CheckoutValidateRequest(
            String paymentMethod,
            String couponCode,
            Integer obPointsToRedeem,
            Integer obBalance,
            Integer shippingAddressId
    ) {}
}
