package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.CartDtos;
import com.oceanbazar.backend.entity.CartEntity;
import com.oceanbazar.backend.entity.CartItemEntity;
import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.OrderItemEntity;
import com.oceanbazar.backend.entity.ProductPricingEntity;
import com.oceanbazar.backend.entity.enums.CustomerType;
import com.oceanbazar.backend.entity.ProductEntity;
import com.oceanbazar.backend.entity.UserEntity;
import com.oceanbazar.backend.mapper.CartMapper;
import com.oceanbazar.backend.repository.CartRepository;
import com.oceanbazar.backend.repository.OrderRepository;
import com.oceanbazar.backend.repository.ProductRepository;
import com.oceanbazar.backend.repository.UserRepository;
import com.oceanbazar.backend.utils.WholesalePricingUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
public class CartService {
    private final CartRepository cartRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;

    public CartDtos.CartResponseDto getCart(String userId) {
        CartEntity cart = cartRepository.findByUserId(userId).orElseGet(() -> {
            CartEntity c = new CartEntity();
            c.setUserId(userId);
            c.setItems(new ArrayList<>());
            return c;
        });

        UserEntity user = userRepository.findById(userId).orElse(null);
        boolean isWholesale = WholesalePricingUtil.isApprovedWholesaleUser(user);
        boolean cappedRetail = false;
        if (cart.getItems() != null && !cart.getItems().isEmpty()) {
            for (CartItemEntity item : cart.getItems()) {
                if (item == null || item.getProductId() == null) continue;
                ProductEntity product = productRepository.findById(item.getProductId()).orElse(null);
                if (product == null) continue;
                int qty = item.getQuantity() == null ? 0 : item.getQuantity();
                if (!isWholesale && qty > WholesalePricingUtil.RETAIL_MAX_ORDER_QTY) {
                    item.setQuantity(WholesalePricingUtil.RETAIL_MAX_ORDER_QTY);
                    qty = WholesalePricingUtil.RETAIL_MAX_ORDER_QTY;
                    cappedRetail = true;
                }
                if (qty <= 0) continue;
                double unitPrice = isWholesale
                        ? WholesalePricingUtil.computeWholesaleUnitPrice(product, qty)
                        : WholesalePricingUtil.computeRetailUnitPrice(product, qty);
                item.setUnitPrice(BigDecimal.valueOf(unitPrice));
            }
        }
        if (cappedRetail) {
            cartRepository.save(cart);
        }

        return toCartResponse(cart);
    }

    public CartDtos.CartResponseDto addToCart(String userId, String productId, Integer quantity) {
        ProductEntity product = productRepository.findById(productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));

        UserEntity userEarly = userRepository.findById(userId).orElse(null);
        boolean wholesaleEarly = WholesalePricingUtil.isApprovedWholesaleUser(userEarly);

        CartEntity cart = cartRepository.findByUserId(userId).orElseGet(() -> {
            CartEntity c = new CartEntity();
            c.setUserId(userId);
            c.setItems(new ArrayList<>());
            return c;
        });

        int qtyToAdd = quantity == null ? 1 : quantity;

        CartItemEntity existing = cart.getItems().stream()
                .filter(i -> productId.equals(i.getProductId()))
                .findFirst()
                .orElse(null);

        if (existing != null) {
            existing.setQuantity((existing.getQuantity() == null ? 0 : existing.getQuantity()) + qtyToAdd);
        } else {
            CartItemEntity item = new CartItemEntity();
            item.setProductId(productId);
            item.setQuantity(qtyToAdd);
            ProductPricingEntity retail = WholesalePricingUtil.findPricing(product, CustomerType.retail);
            item.setUnitPrice(retail != null && retail.getPrice() != null ? retail.getPrice() : BigDecimal.ZERO);
            cart.getItems().add(item);
        }

        UserEntity user = userRepository.findById(userId).orElse(null);
        boolean isWholesale = WholesalePricingUtil.isApprovedWholesaleUser(user);
        int finalQty = 0;
        CartItemEntity updated = cart.getItems().stream()
                .filter(i -> i != null && productId.equals(i.getProductId()))
                .findFirst()
                .orElse(null);
        if (updated != null && updated.getQuantity() != null) finalQty = updated.getQuantity();
        if (!wholesaleEarly && finalQty > WholesalePricingUtil.RETAIL_MAX_ORDER_QTY) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Retail customers may order at most " + WholesalePricingUtil.RETAIL_MAX_ORDER_QTY
                            + " units per product. Apply for wholesale to order more.");
        }
        if (updated != null && finalQty > 0) {
            double unitPrice = isWholesale
                    ? WholesalePricingUtil.computeWholesaleUnitPrice(product, finalQty)
                    : WholesalePricingUtil.computeRetailUnitPrice(product, finalQty);
            updated.setUnitPrice(BigDecimal.valueOf(unitPrice));
        }

        cartRepository.save(cart);
        return toCartResponse(cart);
    }

    public CartDtos.CartResponseDto updateCart(String userId, String productId, Integer quantity) {
        CartEntity cart = cartRepository.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cart not found"));

        CartItemEntity existing = cart.getItems().stream()
                .filter(i -> productId.equals(i.getProductId()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not in cart"));

        existing.setQuantity(quantity == null ? 0 : quantity);

        ProductEntity product = productRepository.findById(productId).orElse(null);
        if (product != null) {
            UserEntity user = userRepository.findById(userId).orElse(null);
            boolean isWholesale = WholesalePricingUtil.isApprovedWholesaleUser(user);
            int qty = existing.getQuantity() == null ? 0 : existing.getQuantity();
            if (!isWholesale && qty > WholesalePricingUtil.RETAIL_MAX_ORDER_QTY) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Retail customers may order at most " + WholesalePricingUtil.RETAIL_MAX_ORDER_QTY
                                + " units per product. Apply for wholesale to order more.");
            }
            if (qty > 0) {
                double unitPrice = isWholesale
                        ? WholesalePricingUtil.computeWholesaleUnitPrice(product, qty)
                        : WholesalePricingUtil.computeRetailUnitPrice(product, qty);
                existing.setUnitPrice(BigDecimal.valueOf(unitPrice));
            }
        }

        cartRepository.save(cart);
        return toCartResponse(cart);
    }

    /**
     * Adds all line items from a past order into the user's cart (merge quantities with addToCart).
     */
    public CartDtos.CartResponseDto reorderFromOrder(String userId, String orderId) {
        if (userId == null || userId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unauthorized");
        }
        if (orderId == null || orderId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order id required");
        }
        OrderEntity order = orderRepository.findById(orderId.trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Order not found"));
        if (!userId.equals(order.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your order");
        }
        List<OrderItemEntity> items = order.getItems();
        if (items == null || items.isEmpty()) {
            return getCart(userId);
        }
        for (OrderItemEntity line : items) {
            if (line == null || line.getProductId() == null) continue;
            int qty = line.getQuantity() == null ? 1 : line.getQuantity();
            addToCart(userId, line.getProductId(), qty > 0 ? qty : 1);
        }
        return getCart(userId);
    }

    public CartDtos.CartResponseDto removeFromCart(String userId, String productId) {
        CartEntity cart = cartRepository.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cart not found"));

        cart.setItems(cart.getItems().stream()
                .filter(i -> i != null && !productId.equals(i.getProductId()))
                .toList());
        cartRepository.save(cart);
        return toCartResponse(cart);
    }

    private CartDtos.CartResponseDto toCartResponse(CartEntity cart) {
        List<CartItemEntity> items = cart.getItems();
        if (items == null) items = List.of();

        Function<String, ProductEntity> productLookup = id -> productRepository.findById(id).orElse(null);
        return CartMapper.toCartResponse(cart, items, productLookup);
    }
}
