package com.oceanbazar.backend.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public final class CatalogDtos {
    private CatalogDtos() {}

    // ─── Category Tree Node ─────────────────────────────────────────────────
    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CategoryTreeNode {
        private String id;
        private String parentId;
        private String nameEn;
        private String nameBn;
        private String slug;
        private String icon;
        private String description;
        private int sortOrder;
        private int depth;
        private String path;
        private boolean isLeaf;
        private long productCount;
        private long childCount;
        private List<CategoryTreeNode> children;
    }

    // ─── Category Breadcrumb ────────────────────────────────────────────────
    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class BreadcrumbItem {
        private String id;
        private String nameEn;
        private String nameBn;
        private String slug;
    }

    // ─── Category Create/Update Request ─────────────────────────────────────
    @Data @NoArgsConstructor @AllArgsConstructor
    public static class CategoryRequest {
        private String name;
        private String nameBn;
        private String icon;
        private String parentId;
        private String description;
        private Integer sortOrder;
    }

    // ─── Category Move Request ──────────────────────────────────────────────
    @Data @NoArgsConstructor @AllArgsConstructor
    public static class MoveRequest {
        private String newParentId;
        private Integer sortOrder;
    }

    // ─── Folder Contents (what the explorer right-panel shows) ──────────────
    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class FolderContents {
        private String categoryId;
        private String categoryName;
        private String path;
        private List<BreadcrumbItem> breadcrumb;
        private List<CategoryTreeNode> subfolders;
        private List<ProductSummary> products;
        private long totalProducts;
    }

    // ─── Product Summary (list/grid item) ───────────────────────────────────
    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class ProductSummary {
        private String id;
        private String titleEn;
        private String titleBn;
        private String sku;
        private String status;
        private int stock;
        private int moq;
        private boolean isFeatured;
        private String primaryImage;
        private String categoryId;
        private String brandId;
        private String brandName;
        private BigDecimal retailPrice;
        private BigDecimal wholesalePrice;
        private Instant createdAt;
    }

    // ─── Product Detail (full view) ─────────────────────────────────────────
    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class ProductDetail {
        private String id;
        private String titleEn;
        private String titleBn;
        private String descriptionEn;
        private String descriptionBn;
        private String categoryId;
        private String brandId;
        private String brand;
        private String sellerId;
        private String sku;
        private String status;
        private BigDecimal weight;
        private String weightUnit;
        private int moq;
        private int stock;
        private String seoTitle;
        private String seoDescription;
        private boolean isFeatured;
        private String specifications;
        private String attributesExtra;
        private BigDecimal ratingAvg;
        private int reviewCount;
        private String brandLogoUrl;
        private Integer popularityRank;
        private String popularityLabelEn;
        private String popularityLabelBn;
        private Instant createdAt;
        private Instant updatedAt;
        private List<AssetDto> assets;
        private List<BannerDto> banners;
        private List<PricingDto> pricing;
        private List<VariantDto> variants;
        private List<AttributeDto> attributes;
        private List<TagDto> tags;
        private List<BreadcrumbItem> breadcrumb;
    }

    // ─── Sub-DTOs ───────────────────────────────────────────────────────────
    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class AssetDto {
        private Integer id;
        private String assetType;
        private String url;
        private String altEn;
        private String altBn;
        private int sortOrder;
        private boolean isPrimary;
        private String colorKey;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class BannerDto {
        private Integer id;
        private String productId;
        private String categoryId;
        private String imageUrl;
        private String linkUrl;
        private String title;
        private String placement;
        private int sortOrder;
        private int rotationMs;
        private boolean enabled;
        private Instant startsAt;
        private Instant endsAt;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PricingDto {
        private Integer id;
        private String customerType;
        private BigDecimal price;
        private BigDecimal compareAt;
        private Integer tier1MinQty;
        private BigDecimal tier1Discount;
        private Integer tier2MinQty;
        private BigDecimal tier2Discount;
        private Integer tier3MinQty;
        private BigDecimal tier3Discount;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class VariantDto {
        private String id;
        private String sku;
        private String nameEn;
        private String nameBn;
        private String attributes;
        private BigDecimal priceOverride;
        private int stock;
        private boolean isActive;
        private int sortOrder;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class AttributeDto {
        private Integer id;
        private String attrKey;
        private String attrValue;
        private int sortOrder;
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class TagDto {
        private Integer id;
        private String nameEn;
        private String nameBn;
        private String slug;
        private String groupName;
    }

    // ─── Search Result ──────────────────────────────────────────────────────
    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class SearchResult {
        private List<CategoryTreeNode> categories;
        private List<ProductSummary> products;
        private List<TagDto> tags;
    }

    // ─── Tag Group with Tags ────────────────────────────────────────────────
    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class TagGroupDto {
        private Integer id;
        private String nameEn;
        private String nameBn;
        private String slug;
        private int sortOrder;
        private List<TagDto> tags;
    }

    // ─── Tag Group / Tag request ────────────────────────────────────────────
    @Data @NoArgsConstructor @AllArgsConstructor
    public static class TagGroupRequest {
        private String nameEn;
        private String nameBn;
        private Integer sortOrder;
    }

    @Data @NoArgsConstructor @AllArgsConstructor
    public static class TagRequest {
        private Integer groupId;
        private String nameEn;
        private String nameBn;
        private Integer sortOrder;
    }
}
