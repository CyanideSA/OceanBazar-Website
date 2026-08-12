package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.CartDtos;
import com.oceanbazar.backend.entity.CartEntity;
import com.oceanbazar.backend.entity.CartItemEntity;
import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.OrderItemEntity;
import com.oceanbazar.backend.entity.ProductPricingEntity;
import com.oceanbazar.backend.entity.ProductVariantEntity;
import com.oceanbazar.backend.entity.enums.CustomerType;
import com.oceanbazar.backend.entity.ProductEntity;
import com.oceanbazar.backend.entity.UserEntity;
import com.oceanbazar.backend.mapper.CartMapper;
import com.oceanbazar.backend.repository.CartRepository;
import com.oceanbazar.backend.repository.OrderRepository;
import com.oceanbazar.backend.repository.ProductRepository;
import com.oceanbazar.backend.repository.ProductVariantRepository;
import com.oceanbazar.backend.repository.UserRepository;
import com.oceanbazar.backend.utils.WholesalePricingUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
@Transactional
public class CartService {
    private final CartRepository cartRepository;
    private final ProductRepository productRepository;
    private final ProductVariantRepository productVariantRepository;
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
                int retailCap = WholesalePricingUtil.retailMaxOrderQty(product);
                if (!isWholesale && qty > retailCap) {
                    item.setQuantity(retailCap);
                    qty = retailCap;
                    cappedRetail = true;
                }
                if (qty <= 0) continue;
                item.setUnitPrice(resolveUnitPrice(product, item.getVariantId(), qty, isWholesale));
            }
        }
        if (cappedRetail) {
            cartRepository.save(cart);
        }

        return toCartResponse(cart);
    }

    public CartDtos.CartResponseDto addToCart(String userId, String productId, Integer quantity) {
        return addToCart(userId, productId, quantity, null);
    }

    public CartDtos.CartResponseDto addToCart(String userId, String productId, Integer quantity, String variantId) {
        ProductEntity product = productRepository.findById(productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));

        String normalizedVariantId = normalizeVariantId(variantId);
        ProductVariantEntity variant = resolveVariant(productId, normalizedVariantId);

        UserEntity userEarly = userRepository.findById(userId).orElse(null);
        boolean wholesaleEarly = WholesalePricingUtil.isApprovedWholesaleUser(userEarly);

        CartEntity cart = cartRepository.findByUserId(userId).orElseGet(() -> {
            CartEntity c = new CartEntity();
            c.setUserId(userId);
            c.setItems(new ArrayList<>());
            return c;
        });
        if (cart.getItems() == null) {
            cart.setItems(new ArrayList<>());
        }

        int qtyToAdd = quantity == null ? 1 : quantity;
        CustomerType lineCustomerType = wholesaleEarly ? CustomerType.wholesale : CustomerType.retail;

        CartItemEntity existing = cart.getItems().stream()
                .filter(i -> sameLine(i, productId, normalizedVariantId))
                .findFirst()
                .orElse(null);

        if (existing != null) {
            existing.setQuantity((existing.getQuantity() == null ? 0 : existing.getQuantity()) + qtyToAdd);
            existing.setCustomerType(lineCustomerType);
            existing.setVariantId(normalizedVariantId);
        } else {
            CartItemEntity item = new CartItemEntity();
            item.setProductId(productId);
            item.setVariantId(normalizedVariantId);
            item.setQuantity(qtyToAdd);
            item.setCustomerType(lineCustomerType);
            ProductPricingEntity retail = WholesalePricingUtil.findPricing(product, CustomerType.retail);
            item.setUnitPrice(retail != null && retail.getPrice() != null ? retail.getPrice() : BigDecimal.ZERO);
            item.setCart(cart);
            cart.getItems().add(item);
        }

        UserEntity user = userRepository.findById(userId).orElse(null);
        boolean isWholesale = WholesalePricingUtil.isApprovedWholesaleUser(user);
        CartItemEntity updated = cart.getItems().stream()
                .filter(i -> sameLine(i, productId, normalizedVariantId))
                .findFirst()
                .orElse(null);
        int finalQty = updated != null && updated.getQuantity() != null ? updated.getQuantity() : 0;
        enforceQuantityLimits(product, variant, finalQty, wholesaleEarly);
        if (updated != null && finalQty > 0) {
            updated.setUnitPrice(resolveUnitPrice(product, normalizedVariantId, finalQty, isWholesale));
        }

        cartRepository.save(cart);
        return toCartResponse(cart);
    }

    public CartDtos.CartResponseDto updateCart(String userId, String productId, Integer quantity) {
        return updateCart(userId, productId, quantity, null);
    }

    public CartDtos.CartResponseDto updateCart(String userId, String productId, Integer quantity, String variantId) {
        int qty = quantity == null ? 0 : quantity;
        String normalizedVariantId = normalizeVariantId(variantId);
        if (qty <= 0) {
            return removeFromCart(userId, productId, normalizedVariantId);
        }

        CartEntity cart = cartRepository.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cart not found"));
        if (cart.getItems() == null) {
            cart.setItems(new ArrayList<>());
        }

        CartItemEntity existing = cart.getItems().stream()
                .filter(i -> sameLine(i, productId, normalizedVariantId))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Item not in cart"));

        existing.setQuantity(qty);

        ProductEntity product = productRepository.findById(productId).orElse(null);
        if (product != null) {
            UserEntity user = userRepository.findById(userId).orElse(null);
            boolean isWholesale = WholesalePricingUtil.isApprovedWholesaleUser(user);
            ProductVariantEntity variant = resolveVariant(productId, normalizedVariantId);
            enforceQuantityLimits(product, variant, qty, isWholesale);
            if (qty > 0) {
                existing.setUnitPrice(resolveUnitPrice(product, normalizedVariantId, qty, isWholesale));
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
            addToCart(userId, line.getProductId(), qty > 0 ? qty : 1, line.getVariantId());
        }
        return getCart(userId);
    }

    public CartDtos.CartResponseDto removeFromCart(String userId, String productId) {
        return removeFromCart(userId, productId, null);
    }

    public CartDtos.CartResponseDto removeFromCart(String userId, String productId, String variantId) {
        CartEntity cart = cartRepository.findByUserId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cart not found"));

        String normalizedVariantId = normalizeVariantId(variantId);
        if (cart.getItems() == null) {
            cart.setItems(new ArrayList<>());
        } else if (normalizedVariantId == null) {
            cart.getItems().removeIf(i -> i != null && productId.equals(i.getProductId()));
        } else {
            cart.getItems().removeIf(i -> sameLine(i, productId, normalizedVariantId));
        }
        cartRepository.save(cart);
        return toCartResponse(cart);
    }

    private static String normalizeVariantId(String variantId) {
        if (variantId == null) return null;
        String trimmed = variantId.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static boolean sameLine(CartItemEntity item, String productId, String variantId) {
        if (item == null || !productId.equals(item.getProductId())) return false;
        return Objects.equals(normalizeVariantId(item.getVariantId()), normalizeVariantId(variantId));
    }

    private ProductVariantEntity resolveVariant(String productId, String variantId) {
        if (variantId == null) return null;
        ProductVariantEntity variant = productVariantRepository.findById(variantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Variant not found"));
        if (!productId.equals(variant.getProductId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Variant does not belong to this product");
        }
        if (Boolean.FALSE.equals(variant.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This option is unavailable");
        }
        return variant;
    }

    private BigDecimal resolveUnitPrice(ProductEntity product, String variantId, int qty, boolean isWholesale) {
        double unitPrice = isWholesale
                ? WholesalePricingUtil.computeWholesaleUnitPrice(product, qty)
                : WholesalePricingUtil.computeRetailUnitPrice(product, qty);
        if (variantId != null) {
            ProductVariantEntity variant = productVariantRepository.findById(variantId).orElse(null);
            if (variant != null && variant.getPriceOverride() != null) {
                unitPrice = variant.getPriceOverride().doubleValue();
            }
        }
        return BigDecimal.valueOf(unitPrice);
    }

    /**
     * Mirrors storefront product-page limits: per-product retail cap
     * (retail tier-3 threshold from the admin CRM) plus available stock.
     */
    private void enforceQuantityLimits(ProductEntity product, ProductVariantEntity variant, int qty, boolean isWholesale) {
        if (product == null || qty <= 0) return;
        if (!isWholesale) {
            int retailCap = WholesalePricingUtil.retailMaxOrderQty(product);
            if (qty > retailCap) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "You can order at most " + retailCap
                                + " units of this product. Apply for wholesale to order more.");
            }
        }
        Integer stock = variant != null && variant.getStock() != null ? variant.getStock() : product.getStock();
        if (stock != null && stock > 0 && qty > stock) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only " + stock + " units in stock for this option.");
        }
    }

    private CartDtos.CartResponseDto toCartResponse(CartEntity cart) {
        List<CartItemEntity> items = cart.getItems();
        if (items == null) items = List.of();

        Function<String, ProductEntity> productLookup = id -> productRepository.findById(id).orElse(null);
        Function<String, ProductVariantEntity> variantLookup = id -> productVariantRepository.findById(id).orElse(null);
        return CartMapper.toCartResponse(cart, items, productLookup, variantLookup);
    }
}
