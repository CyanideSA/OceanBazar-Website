package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.OrderDtos;
import com.oceanbazar.backend.entity.CartEntity;
import com.oceanbazar.backend.entity.CartItemEntity;
import com.oceanbazar.backend.entity.CouponEntity;
import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.OrderFeedbackEntity;
import com.oceanbazar.backend.entity.OrderItemEntity;
import com.oceanbazar.backend.entity.ProductEntity;
import com.oceanbazar.backend.entity.UserEntity;
import com.oceanbazar.backend.entity.enums.CustomerType;
import com.oceanbazar.backend.entity.enums.OrderStatus;
import com.oceanbazar.backend.entity.enums.PaymentMethod;
import com.oceanbazar.backend.entity.enums.PaymentStatus;
import com.oceanbazar.backend.mapper.OrderMapper;
import com.oceanbazar.backend.repository.CartRepository;
import com.oceanbazar.backend.repository.OrderFeedbackRepository;
import com.oceanbazar.backend.repository.OrderRepository;
import com.oceanbazar.backend.repository.ProductRepository;
import com.oceanbazar.backend.repository.UserRepository;
import com.oceanbazar.backend.utils.CheckoutTotalsCalculator;
import com.oceanbazar.backend.utils.OrderNumberGenerator;
import com.oceanbazar.backend.utils.PaymentParsing;
import com.oceanbazar.backend.utils.ShortId;
import com.oceanbazar.backend.utils.WholesalePricingUtil;
import com.oceanbazar.backend.events.DomainEventPublisher;
import com.oceanbazar.backend.events.OrderPlacedEvent;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class OrderService {
    private final CartRepository cartRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final CouponService couponService;
    private final AdminAlertService adminAlertService;
    private final CustomerNotificationService customerNotificationService;
    private final InventoryService inventoryService;
    private final DomainEventPublisher domainEventPublisher;
    private final OrderFeedbackRepository orderFeedbackRepository;

    public OrderService(
            CartRepository cartRepository,
            ProductRepository productRepository,
            OrderRepository orderRepository,
            UserRepository userRepository,
            CouponService couponService,
            AdminAlertService adminAlertService,
            CustomerNotificationService customerNotificationService,
            InventoryService inventoryService,
            DomainEventPublisher domainEventPublisher,
            OrderFeedbackRepository orderFeedbackRepository
    ) {
        this.cartRepository = cartRepository;
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
        this.userRepository = userRepository;
        this.couponService = couponService;
        this.adminAlertService = adminAlertService;
        this.customerNotificationService = customerNotificationService;
        this.inventoryService = inventoryService;
        this.domainEventPublisher = domainEventPublisher;
        this.orderFeedbackRepository = orderFeedbackRepository;
    }

    public Map<String, Object> placeOrder(String userId, OrderDtos.PlaceOrderRequest request) {
        if (userId == null || userId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing user id");
        }

        CartEntity cart = cartRepository.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cart not found"));

        List<CartItemEntity> cartItems = cart.getItems() == null ? List.of() : cart.getItems();
        if (cartItems.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cart is empty");
        }

        if (request == null) {
            request = new OrderDtos.PlaceOrderRequest();
        }

        UserEntity user = userRepository.findById(userId).orElse(null);
        boolean isWholesale = WholesalePricingUtil.isApprovedWholesaleUser(user);

        String newOrderId = allocateUniqueOrderId();

        double merchandiseSubtotal = 0.0;
        List<OrderItemEntity> lineItems = new ArrayList<>();

        for (CartItemEntity item : cartItems) {
            if (item == null || item.getProductId() == null) continue;
            int qty = item.getQuantity() == null ? 0 : item.getQuantity();
            if (qty <= 0) continue;

            if (!isWholesale && qty > WholesalePricingUtil.RETAIL_MAX_ORDER_QTY) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Retail customers may order at most " + WholesalePricingUtil.RETAIL_MAX_ORDER_QTY
                                + " units per product per line. Apply for wholesale to order more.");
            }

            ProductEntity product = productRepository.findById(item.getProductId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));

            if (inventoryService.isInventoryTracked(product.getId())) {
                inventoryService.tryDeductForPlacedOrder(product.getId(), qty, newOrderId);
            } else {
                int stockAvailable = product.getStock() == null ? 0 : product.getStock();
                if (stockAvailable < qty) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "Insufficient stock for " + product.getTitleEn()
                    );
                }
                product.setStock(stockAvailable - qty);
                productRepository.save(product);
            }

            double unitPrice = isWholesale
                    ? WholesalePricingUtil.computeWholesaleUnitPrice(product, qty)
                    : WholesalePricingUtil.computeRetailUnitPrice(product, qty);
            double lineTotal = unitPrice * qty;
            merchandiseSubtotal += lineTotal;

            BigDecimal unitBd = BigDecimal.valueOf(unitPrice).setScale(2, RoundingMode.HALF_UP);
            BigDecimal lineBd = BigDecimal.valueOf(lineTotal).setScale(2, RoundingMode.HALF_UP);

            OrderItemEntity oi = new OrderItemEntity();
            oi.setOrderId(newOrderId);
            oi.setProductId(product.getId());
            oi.setVariantId(item.getVariantId());
            oi.setProductTitle(product.getTitleEn());
            oi.setUnitPrice(unitBd);
            oi.setQuantity(qty);
            oi.setLineTotal(lineBd);
            oi.setDiscountPct(BigDecimal.ZERO);
            lineItems.add(oi);
        }

        if (lineItems.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cart contains no valid items");
        }

        double discountAmount = 0.0;
        String couponCode = request.getCouponCode();
        Integer appliedCouponId = null;
        if (couponCode != null && !couponCode.isBlank()) {
            Map<String, Object> couponResult;
            try {
                couponResult = couponService.validateCoupon(couponCode.trim(), merchandiseSubtotal, userId);
            } catch (ResponseStatusException ex) {
                throw ex;
            } catch (Exception ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid coupon");
            }

            boolean valid = (Boolean) couponResult.getOrDefault("valid", false);
            if (!valid) {
                String msg = String.valueOf(couponResult.getOrDefault("message", "Invalid coupon"));
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, msg);
            }

            Object discountObj = couponResult.get("discount");
            discountAmount = discountObj instanceof Number ? ((Number) discountObj).doubleValue() : 0.0;
            Object couponEnt = couponResult.get("coupon");
            if (couponEnt instanceof CouponEntity c && c.getId() != null) {
                appliedCouponId = c.getId();
            }
        }

        double discountedMerchandise = Math.max(0.0, merchandiseSubtotal - discountAmount);
        CheckoutTotalsCalculator.Totals checkoutTotals = CheckoutTotalsCalculator.compute(discountedMerchandise);

        Integer shippingAddressId = null;
        if (request.getShippingAddress() != null) {
            Object idObj = request.getShippingAddress().get("id");
            if (idObj instanceof Number) {
                shippingAddressId = ((Number) idObj).intValue();
            } else if (idObj != null) {
                try {
                    shippingAddressId = Integer.parseInt(String.valueOf(idObj).trim());
                } catch (NumberFormatException ignored) {
                    shippingAddressId = null;
                }
            }
        }

        PaymentMethod paymentMethod = PaymentParsing.parsePaymentMethod(request.getPaymentMethod());

        OrderEntity order = new OrderEntity();
        order.setId(newOrderId);
        order.setUserId(userId);
        order.setCustomerType(isWholesale ? CustomerType.wholesale : CustomerType.retail);
        order.setPaymentMethod(paymentMethod);
        order.setItems(lineItems);
        order.setSubtotal(BigDecimal.valueOf(discountedMerchandise).setScale(2, RoundingMode.HALF_UP));
        order.setDiscount(BigDecimal.valueOf(discountAmount).setScale(2, RoundingMode.HALF_UP));
        order.setShippingFee(BigDecimal.valueOf(checkoutTotals.getShipping()).setScale(2, RoundingMode.HALF_UP));
        order.setGst(BigDecimal.valueOf(checkoutTotals.getGst()).setScale(2, RoundingMode.HALF_UP));
        order.setServiceFee(BigDecimal.valueOf(checkoutTotals.getServiceFee()).setScale(2, RoundingMode.HALF_UP));
        order.setTotal(BigDecimal.valueOf(checkoutTotals.getTotal()).setScale(2, RoundingMode.HALF_UP));
        order.setStatus(OrderStatus.pending);
        allocateUniqueOrderNumber(order);
        order.setShippingAddressId(shippingAddressId);
        order.setPaymentStatus(PaymentStatus.unpaid);
        order.setCouponId(appliedCouponId);
        order.setCreatedAt(Instant.now());
        order.setUpdatedAt(Instant.now());
        OrderTimelineSupport.recordInitialPlaced(order);

        OrderEntity saved = orderRepository.save(order);

        cart.setItems(new ArrayList<>());
        cartRepository.save(cart);

        if (appliedCouponId != null) {
            try {
                couponService.incrementUsage(appliedCouponId);
            } catch (Exception ignored) {
            }
        }

        adminAlertService.notifyNewOrder(saved);

        String ref = saved.getOrderNumber() != null && !saved.getOrderNumber().isBlank()
                ? saved.getOrderNumber()
                : saved.getId();
        customerNotificationService.notifyCustomer(
                userId,
                "Order placed successfully",
                "We received your order " + ref + ". You can track it anytime under My Orders.",
                "order",
                saved.getId()
        );

        domainEventPublisher.publish(new OrderPlacedEvent(
                userId,
                saved.getId(),
                saved.getOrderNumber(),
                saved.getStatus() != null ? saved.getStatus().name() : "pending"));

        return placeOrderResponse(saved);
    }

    public OrderDtos.OrderResponseDto submitBuyerFeedback(String userId, String orderId, OrderDtos.OrderFeedbackRequest req) {
        if (userId == null || userId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }
        if (orderId == null || orderId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order id required");
        }
        if (req == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body required");
        }
        boolean hasRating = req.getRating() != null;
        boolean hasComment = req.getComment() != null && !req.getComment().isBlank();
        if (!hasRating && !hasComment) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rating and/or comment required");
        }
        OrderEntity order = orderRepository.findById(orderId.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        if (!userId.equals(order.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your order");
        }
        if (orderFeedbackRepository.existsByOrderId(orderId.trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Feedback already submitted");
        }

        OrderFeedbackEntity record = new OrderFeedbackEntity();
        record.setOrderId(orderId.trim());
        record.setUserId(userId);
        record.setRating(hasRating ? req.getRating() : null);
        record.setComment(hasComment ? req.getComment().trim() : null);
        record.setCreatedAt(Instant.now());
        orderFeedbackRepository.save(record);

        return OrderMapper.toOrderResponse(order);
    }

    public Map<String, Object> cancelOrder(String userId, String orderId) {
        OrderEntity order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        if (!order.getUserId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your order");
        }
        OrderStatus status = order.getStatus();
        if (status == OrderStatus.shipped || status == OrderStatus.delivered || status == OrderStatus.cancelled) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order cannot be cancelled in its current state");
        }
        order.setStatus(OrderStatus.cancelled);
        orderRepository.save(order);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("orderId", orderId);
        body.put("status", "cancelled");
        return body;
    }

    private String allocateUniqueOrderId() {
        for (int i = 0; i < 64; i++) {
            String id = ShortId.newId8();
            if (!orderRepository.existsById(id)) {
                return id;
            }
        }
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not allocate order id");
    }

    private void allocateUniqueOrderNumber(OrderEntity order) {
        for (int i = 0; i < 64; i++) {
            String n = OrderNumberGenerator.nextOrderNumber();
            if (!orderRepository.existsByOrderNumber(n)) {
                order.setOrderNumber(n);
                return;
            }
        }
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not allocate order number");
    }

    private static Map<String, Object> placeOrderResponse(OrderEntity order) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", true);
        body.put("orderId", order.getId());
        body.put("orderNumber", order.getOrderNumber());
        body.put("status", order.getStatus() != null ? order.getStatus().name() : null);
        body.put("total", order.getTotal() != null ? order.getTotal().doubleValue() : null);
        body.put("gst", order.getGst() != null ? order.getGst().doubleValue() : null);
        body.put("serviceFee", order.getServiceFee() != null ? order.getServiceFee().doubleValue() : null);
        return body;
    }
}
