package com.oceanbazar.backend.mapper;

import com.oceanbazar.backend.dto.CartDtos;
import com.oceanbazar.backend.entity.CartEntity;
import com.oceanbazar.backend.entity.CartItemEntity;
import com.oceanbazar.backend.entity.ProductEntity;
import com.oceanbazar.backend.entity.ProductAssetEntity;
import com.oceanbazar.backend.utils.CheckoutTotalsCalculator;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public final class CartMapper {
    private CartMapper() {}

    private static double bd(BigDecimal v) {
        return v == null ? 0.0 : v.doubleValue();
    }

    private static String firstImageUrl(ProductEntity p) {
        if (p.getAssets() == null || p.getAssets().isEmpty()) return null;
        return p.getAssets().stream()
                .sorted(Comparator.comparing(ProductAssetEntity::getSortOrder, Comparator.nullsLast(Integer::compareTo)))
                .map(ProductAssetEntity::getUrl)
                .filter(u -> u != null && !u.isBlank())
                .findFirst()
                .orElse(null);
    }

    private static List<String> imageUrls(ProductEntity p) {
        if (p.getAssets() == null) return List.of();
        return p.getAssets().stream()
                .sorted(Comparator.comparing(ProductAssetEntity::getSortOrder, Comparator.nullsLast(Integer::compareTo)))
                .map(ProductAssetEntity::getUrl)
                .filter(u -> u != null && !u.isBlank())
                .collect(Collectors.toList());
    }

    public static CartDtos.CartResponseDto toCartResponse(
            CartEntity cart,
            List<CartItemEntity> items,
            java.util.function.Function<String, ProductEntity> productLookup) {
        List<CartDtos.CartItemDto> itemsResponse = new ArrayList<>();
        double subtotal = 0.0;
        List<CartItemEntity> safeItems = items == null ? List.of() : items;

        for (CartItemEntity item : safeItems) {
            if (item == null || item.getProductId() == null) continue;
            ProductEntity product = productLookup.apply(item.getProductId());
            if (product == null) continue;

            int qty = item.getQuantity() == null ? 0 : item.getQuantity();
            double price = bd(item.getUnitPrice());
            subtotal += qty * price;

            Map<String, Object> productMap = new HashMap<>();
            productMap.put("id", product.getId());
            productMap.put("name", product.getTitleEn());
            productMap.put("category", product.getCategoryId());
            productMap.put("price", price);
            productMap.put("retailPrice", com.oceanbazar.backend.utils.WholesalePricingUtil.computeRetailUnitPrice(product, 1));
            productMap.put("wholesalePrice", com.oceanbazar.backend.utils.WholesalePricingUtil.getWholesaleBasePrice(product));
            productMap.put("moq", product.getMoq());
            productMap.put("image", firstImageUrl(product));
            productMap.put("images", imageUrls(product));
            productMap.put("supplier", product.getSellerId());
            productMap.put("rating", product.getRatingAvg() != null ? product.getRatingAvg().doubleValue() : 0.0);
            productMap.put("orders", product.getPopularityRank() != null ? product.getPopularityRank() : 0);
            productMap.put("verified", true);
            productMap.put("tags", List.of());
            productMap.put("description", product.getDescriptionEn() == null ? "" : product.getDescriptionEn());
            productMap.put("stock", product.getStock() == null ? 0 : product.getStock());

            CartDtos.CartItemDto itemDto = new CartDtos.CartItemDto();
            itemDto.setId(item.getProductId());
            itemDto.setProduct(productMap);
            itemDto.setQuantity(qty);
            itemDto.setPrice(price);

            itemsResponse.add(itemDto);
        }

        CheckoutTotalsCalculator.Totals t = CheckoutTotalsCalculator.compute(subtotal);

        CartDtos.CartResponseDto res = new CartDtos.CartResponseDto();
        res.setItems(itemsResponse);
        res.setSubtotal(subtotal);
        res.setShipping(t.getShipping());
        res.setGst(t.getGst());
        res.setServiceFee(t.getServiceFee());
        res.setTotal(t.getTotal());
        return res;
    }

    public static CartDtos.CartResponseDto toCartResponse(
            CartEntity cart,
            java.util.List<CartItemEntity> items,
            java.util.Map<String, ProductEntity> productsById) {
        return toCartResponse(cart, items, productsById::get);
    }
}
