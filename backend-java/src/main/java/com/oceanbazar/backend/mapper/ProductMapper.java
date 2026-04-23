package com.oceanbazar.backend.mapper;

import com.oceanbazar.backend.dto.ProductDtos;
import com.oceanbazar.backend.entity.ProductAttributeEntity;
import com.oceanbazar.backend.entity.ProductAssetEntity;
import com.oceanbazar.backend.entity.ProductEntity;
import com.oceanbazar.backend.entity.ProductPricingEntity;
import com.oceanbazar.backend.entity.ProductReviewEntity;
import com.oceanbazar.backend.entity.TagEntity;
import com.oceanbazar.backend.entity.enums.CustomerType;
import com.oceanbazar.backend.utils.ProductUrlUtil;
import com.oceanbazar.backend.utils.WholesalePricingUtil;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class ProductMapper {
    private ProductMapper() {}

    private static String firstImageUrl(ProductEntity product) {
        if (product.getAssets() == null || product.getAssets().isEmpty()) {
            return null;
        }
        return product.getAssets().stream()
                .sorted(Comparator.comparing(ProductAssetEntity::getSortOrder, Comparator.nullsLast(Integer::compareTo)))
                .map(ProductAssetEntity::getUrl)
                .filter(u -> u != null && !u.isBlank())
                .findFirst()
                .orElse(null);
    }

    private static List<String> imageUrls(ProductEntity product) {
        if (product.getAssets() == null) return List.of();
        return product.getAssets().stream()
                .sorted(Comparator.comparing(ProductAssetEntity::getSortOrder, Comparator.nullsLast(Integer::compareTo)))
                .map(ProductAssetEntity::getUrl)
                .filter(u -> u != null && !u.isBlank())
                .map(ProductUrlUtil::normalizeProductImageUrl)
                .toList();
    }

    public static ProductDtos.ProductDto toProductDto(ProductEntity product) {
        if (product == null) return null;
        double rb = WholesalePricingUtil.findPricing(product, CustomerType.retail) != null
                && WholesalePricingUtil.findPricing(product, CustomerType.retail).getPrice() != null
                ? WholesalePricingUtil.findPricing(product, CustomerType.retail).getPrice().doubleValue()
                : 0.0;
        double wb = WholesalePricingUtil.getWholesaleBasePrice(product);
        ProductPricingEntity retail = WholesalePricingUtil.findPricing(product, CustomerType.retail);
        Double compareAt = retail != null && retail.getCompareAt() != null ? retail.getCompareAt().doubleValue() : null;
        int[] br = WholesalePricingUtil.resolveWholesaleBreaks(product);

        ProductDtos.ProductDto dto = new ProductDtos.ProductDto();
        dto.setId(product.getId());
        dto.setName(product.getTitleEn());
        dto.setCategory(product.getCategoryId());
        dto.setBrand(product.getBrand());
        dto.setPrice(rb);
        dto.setRetailPrice(rb);
        dto.setCompareAtPrice(compareAt);
        dto.setWholesalePrice(wb);
        dto.setWholesaleBreakQty1(br[0]);
        dto.setWholesaleBreakQty2(br[1]);
        dto.setWholesaleBreakQty3(br[2]);
        dto.setDiscountTiers(List.of());
        dto.setMoq(product.getMoq());
        dto.setImage(ProductUrlUtil.normalizeProductImageUrl(firstImageUrl(product)));
        dto.setImages(imageUrls(product));
        dto.setVideos(List.of());
        dto.setSupplier(product.getSellerId());
        dto.setRating(product.getRatingAvg() != null ? product.getRatingAvg().doubleValue() : 0.0);
        dto.setOrders(product.getPopularityRank());
        dto.setVerified(true);
        dto.setTags(List.of());
        dto.setDescription(product.getDescriptionEn());
        dto.setStock(product.getStock());
        dto.setFeaturedSale(Boolean.TRUE.equals(product.getIsFeatured()));
        dto.setAttributes(Map.of());
        dto.setRetailPricing(List.of());
        dto.setWholesalePricing(List.of());
        return dto;
    }

    private static final DateTimeFormatter ISO_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss'Z'").withZone(ZoneId.of("UTC"));

    public static ProductDtos.ProductDetailResponseDto toProductDetail(
            ProductEntity product,
            List<TagEntity> tags,
            List<ProductReviewEntity> reviews) {
        if (product == null) return null;

        double listPrice = WholesalePricingUtil.findPricing(product, CustomerType.retail) != null
                && WholesalePricingUtil.findPricing(product, CustomerType.retail).getPrice() != null
                ? WholesalePricingUtil.findPricing(product, CustomerType.retail).getPrice().doubleValue()
                : 0.0;
        double retailBase = listPrice;
        List<Map<String, Object>> retailPricing = List.of(
                Map.of("minQty", 1, "maxQty", 1, "discount", 0, "pricePerUnit", round2(retailBase)),
                Map.of("minQty", 2, "maxQty", 10, "discount", 5, "pricePerUnit", round2(retailBase * 0.95)),
                Map.of("minQty", 11, "maxQty", 20, "discount", 10, "pricePerUnit", round2(retailBase * 0.90)),
                Map.of("minQty", 21, "maxQty", 25, "discount", 15, "pricePerUnit", round2(retailBase * 0.85))
        );

        double wholesaleBase = WholesalePricingUtil.getWholesaleBasePrice(product);
        int[] br = WholesalePricingUtil.resolveWholesaleBreaks(product);
        int b1 = br[0];
        int b2 = br[1];
        int b3 = br[2];
        List<Map<String, Object>> wholesalePricing = new ArrayList<>();
        wholesalePricing.add(tierRow(1, 25, "retail_volume", 0.0, round2(retailBase)));
        wholesalePricing.add(tierRow(WholesalePricingUtil.WHOLESALE_VOLUME_MIN_QTY, b1, "wholesale_base", 0.0,
                wholesaleBase));
        wholesalePricing.add(tierRow(b1 + 1, b2, "wholesale_vol", 0.03, round2(wholesaleBase * 0.97)));
        wholesalePricing.add(tierRow(b2 + 1, b3, "wholesale_vol", 0.05, round2(wholesaleBase * 0.95)));
        wholesalePricing.add(tierRow(b3 + 1, null, "wholesale_vol", 0.08, round2(wholesaleBase * 0.92)));

        String img = firstImageUrl(product);
        String primaryImage = (img == null || img.isBlank())
                ? "https://placehold.co/600x600/e4f0f9/5ba3d0?text=OceanBazar"
                : ProductUrlUtil.normalizeProductImageUrl(img);

        List<String> imageList = new ArrayList<>(imageUrls(product));
        if (imageList.isEmpty()) {
            imageList.add(primaryImage);
        }

        List<ProductDtos.ProductImageDto> richImages = new ArrayList<>();
        if (product.getAssets() != null) {
            for (ProductAssetEntity a : product.getAssets()) {
                ProductDtos.ProductImageDto imgDto = new ProductDtos.ProductImageDto();
                imgDto.setId(a.getId());
                imgDto.setUrl(ProductUrlUtil.normalizeProductImageUrl(a.getUrl()));
                imgDto.setAltEn(a.getAltEn());
                imgDto.setAltBn(a.getAltBn());
                imgDto.setSortOrder(a.getSortOrder());
                imgDto.setMediaType(a.getAssetType() != null ? a.getAssetType().name() : "image");
                imgDto.setIsPrimary(Boolean.TRUE.equals(a.getIsPrimary()));
                imgDto.setColorKey(a.getColorKey());
                richImages.add(imgDto);
            }
        }

        Map<String, Object> attributes = new LinkedHashMap<>();
        if (product.getAttributes() != null) {
            for (ProductAttributeEntity attr : product.getAttributes()) {
                attributes.put(attr.getAttrKey(), attr.getAttrValue());
            }
        }

        Map<String, Object> specifications = new LinkedHashMap<>();
        if (product.getSpecifications() != null && !product.getSpecifications().isBlank()) {
            try {
                com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();
                @SuppressWarnings("unchecked")
                Map<String, Object> parsed = om.readValue(product.getSpecifications(), Map.class);
                specifications.putAll(parsed);
            } catch (Exception ignored) {}
        }
        if (product.getAttributesExtra() != null && !product.getAttributesExtra().isBlank()) {
            try {
                com.fasterxml.jackson.databind.ObjectMapper om = new com.fasterxml.jackson.databind.ObjectMapper();
                @SuppressWarnings("unchecked")
                Map<String, Object> parsed = om.readValue(product.getAttributesExtra(), Map.class);
                specifications.putAll(parsed);
            } catch (Exception ignored) {}
        }
        if (product.getWeight() != null) {
            specifications.put("Weight", product.getWeight().toPlainString()
                    + (product.getWeightUnit() != null ? " " + product.getWeightUnit() : ""));
        }
        if (product.getSku() != null) specifications.put("SKU", product.getSku());

        List<String> tagNames = tags == null ? List.of()
                : tags.stream().map(TagEntity::getNameEn).toList();

        List<ProductDtos.ReviewDto> reviewDtos = new ArrayList<>();
        if (reviews != null) {
            for (ProductReviewEntity r : reviews) {
                ProductDtos.ReviewDto rd = new ProductDtos.ReviewDto();
                rd.setAuthorName(r.getUserId());
                rd.setRating(r.getRating());
                rd.setTitle(r.getTitle());
                rd.setBody(r.getBody());
                rd.setCreatedAt(r.getCreatedAt() != null ? ISO_FMT.format(r.getCreatedAt()) : null);
                reviewDtos.add(rd);
            }
        }

        ProductPricingEntity retail = WholesalePricingUtil.findPricing(product, CustomerType.retail);

        ProductDtos.ProductDetailResponseDto dto = new ProductDtos.ProductDetailResponseDto();
        dto.setId(product.getId());
        dto.setName(product.getTitleEn());
        dto.setSku(product.getSku());
        dto.setCategory(product.getCategoryId());
        dto.setCategoryId(product.getCategoryId());
        dto.setBrand(product.getBrand());
        dto.setBrandLogoUrl(product.getBrandLogoUrl() != null
                ? ProductUrlUtil.normalizeProductImageUrl(product.getBrandLogoUrl()) : null);
        dto.setPrice(listPrice);
        dto.setRetailPrice(retailBase);
        dto.setCompareAtPrice(retail != null && retail.getCompareAt() != null ? retail.getCompareAt().doubleValue() : null);
        dto.setWholesalePrice(wholesaleBase);
        dto.setWholesaleBreakQty1(br[0]);
        dto.setWholesaleBreakQty2(br[1]);
        dto.setWholesaleBreakQty3(br[2]);
        dto.setDiscountTiers(List.of());
        dto.setMoq(product.getMoq());
        dto.setStock(product.getStock() == null ? 0 : product.getStock());
        dto.setImage(primaryImage);
        dto.setRichImages(richImages);
        dto.setImages(imageList);
        dto.setVideos(List.of());
        dto.setSupplier(product.getSellerId());
        dto.setRating(product.getRatingAvg() != null ? product.getRatingAvg().doubleValue() : 0.0);
        dto.setRatingCount(product.getReviewCount() != null ? product.getReviewCount() : 0);
        dto.setOrders(product.getPopularityRank());
        dto.setVerified(true);
        dto.setFeaturedSale(Boolean.TRUE.equals(product.getIsFeatured()));
        dto.setTags(tagNames);
        dto.setDescription(product.getDescriptionEn() == null ? "" : product.getDescriptionEn());
        dto.setAttributes(attributes);
        dto.setSpecifications(specifications);
        dto.setWeight(product.getWeight() != null ? product.getWeight().doubleValue() : null);
        dto.setWeightUnit(product.getWeightUnit());
        dto.setRetailPricing(retailPricing);
        dto.setWholesalePricing(wholesalePricing);
        dto.setReviews(reviewDtos);
        dto.setPopularityRank(product.getPopularityRank());
        dto.setPopularityLabel(product.getPopularityLabelEn());
        return dto;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private static Map<String, Object> tierRow(int minQty, Integer maxQty, String kind, double volDiscount, double unitPrice) {
        Map<String, Object> m = new HashMap<>();
        m.put("minQty", minQty);
        m.put("maxQty", maxQty);
        m.put("kind", kind);
        m.put("volumeDiscountPct", volDiscount);
        m.put("pricePerUnit", unitPrice);
        return m;
    }
}
