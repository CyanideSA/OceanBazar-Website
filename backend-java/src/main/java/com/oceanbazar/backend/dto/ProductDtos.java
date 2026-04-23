package com.oceanbazar.backend.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

public class ProductDtos {

    @Data
    public static class ProductDto {
        private String id;
        private String name;
        private String category;
        private String brand;
        private Double price;
        private Double retailPrice;
        /** Optional strike / previous reference price per unit (e.g. pre-promo). */
        private Double compareAtPrice;
        private Double wholesalePrice;
        private Integer wholesaleBreakQty1;
        private Integer wholesaleBreakQty2;
        private Integer wholesaleBreakQty3;
        private List<Map<String, Object>> discountTiers;
        private Integer moq;
        private String image;
        private List<String> images;
        private List<String> videos;
        private String supplier;
        private Double rating;
        private Integer orders;
        private Boolean verified;
        private List<String> tags;
        private String description;
        private Integer stock;
        private Boolean featuredSale;
        private Map<String, Object> attributes;
        private List<Map<String, Object>> retailPricing;
        private List<Map<String, Object>> wholesalePricing;
    }

    /**
     * Mirrors the existing JSON payload from {@code GET /api/products/{productId}}.
     */
    @Data
    public static class ReviewDto {
        private String authorName;
        private Integer rating;
        private String title;
        private String body;
        private String createdAt;
    }

    @Data
    public static class ProductImageDto {
        private Integer id;
        private String url;
        private String altEn;
        private String altBn;
        private Integer sortOrder;
        private String mediaType;
        private Boolean isPrimary;
        private String colorKey;
    }

    @Data
    public static class ProductDetailResponseDto {
        private String id;
        private String name;
        private String sku;
        private String category;
        private String categoryId;
        private String brand;
        private String brandLogoUrl;
        private Double price;
        private Double retailPrice;
        private Double compareAtPrice;
        private Double wholesalePrice;
        private Integer wholesaleBreakQty1;
        private Integer wholesaleBreakQty2;
        private Integer wholesaleBreakQty3;
        private List<Map<String, Object>> discountTiers;
        private Integer moq;
        private Integer stock;
        private String image;
        private List<ProductImageDto> richImages;
        private List<String> images;
        private List<String> videos;
        private String supplier;
        private Double rating;
        private Integer ratingCount;
        private Integer orders;
        private Boolean verified;
        private Boolean featuredSale;
        private List<String> tags;
        private String description;
        private Map<String, Object> attributes;
        private Map<String, Object> specifications;
        private Double weight;
        private String weightUnit;
        private List<Map<String, Object>> retailPricing;
        private List<Map<String, Object>> wholesalePricing;
        private List<ReviewDto> reviews;
        private Integer popularityRank;
        private String popularityLabel;
    }

    @Data
    public static class ProductListResponseDto {
        private List<ProductDto> products;
        private long total;
        private int page;
        private int totalPages;
    }
}

