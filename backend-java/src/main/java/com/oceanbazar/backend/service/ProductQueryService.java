package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.ProductDtos;
import com.oceanbazar.backend.entity.ProductEntity;
import com.oceanbazar.backend.entity.ProductReviewEntity;
import com.oceanbazar.backend.entity.TagEntity;
import com.oceanbazar.backend.entity.ProductTagEntity;
import com.oceanbazar.backend.entity.enums.ReviewStatus;
import com.oceanbazar.backend.mapper.ProductMapper;
import com.oceanbazar.backend.repository.ProductRepository;
import com.oceanbazar.backend.repository.ProductTagRepository;
import com.oceanbazar.backend.repository.ReviewRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProductQueryService {
    private final EntityManager entityManager;
    private final ProductRepository productRepository;
    private final ProductTagRepository productTagRepository;
    private final ReviewRepository reviewRepository;

    public ProductDtos.ProductListResponseDto getProducts(
            String search,
            String category,
            String categories,
            Boolean featuredSale,
            Double minPrice,
            Double maxPrice,
            Boolean verified,
            String brand,
            Double minRating,
            String sort,
            int page,
            int limit
    ) {
        List<String> conditions = new ArrayList<>();
        Map<String, Object> params = new LinkedHashMap<>();

        conditions.add("p.status = :activeStatus");
        params.put("activeStatus", "active");

        if (search != null && !search.isBlank()) {
            conditions.add("(LOWER(p.titleEn) LIKE :search OR LOWER(p.titleBn) LIKE :search)");
            params.put("search", "%" + search.trim().toLowerCase() + "%");
        }

        boolean needCategoryJoin = false;
        if (categories != null && !categories.isBlank()) {
            List<String> requested = java.util.Arrays.stream(categories.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .map(s -> s.replace("-", " ").toLowerCase())
                    .toList();
            if (!requested.isEmpty()) {
                needCategoryJoin = true;
                conditions.add("LOWER(cat.nameEn) IN (:categoryNames)");
                params.put("categoryNames", requested);
            }
        } else if (category != null && !category.isBlank()) {
            String normalized = category.trim().replace("-", " ").toLowerCase();
            needCategoryJoin = true;
            conditions.add("LOWER(cat.nameEn) = :categoryName");
            params.put("categoryName", normalized);
        }

        boolean needPriceJoin = minPrice != null || maxPrice != null
                || "price-low".equals(sort) || "price-high".equals(sort);

        if (minPrice != null) {
            conditions.add("pp.price >= :minPrice");
            params.put("minPrice", BigDecimal.valueOf(minPrice));
        }
        if (maxPrice != null) {
            conditions.add("pp.price <= :maxPrice");
            params.put("maxPrice", BigDecimal.valueOf(maxPrice));
        }

        if (featuredSale != null) {
            conditions.add("p.isFeatured = :featured");
            params.put("featured", featuredSale);
        }

        if (brand != null && !brand.isBlank()) {
            conditions.add("LOWER(p.brand) = :brand");
            params.put("brand", brand.trim().toLowerCase());
        }

        if (minRating != null && minRating > 0) {
            conditions.add("p.ratingAvg >= :minRating");
            params.put("minRating", BigDecimal.valueOf(minRating));
        }

        StringBuilder from = new StringBuilder("FROM ProductEntity p");
        if (needCategoryJoin) {
            from.append(" JOIN CategoryEntity cat ON cat.id = p.categoryId");
        }
        if (needPriceJoin) {
            from.append(" LEFT JOIN ProductPricingEntity pp ON pp.productId = p.id");
        }

        String whereClause = String.join(" AND ", conditions);

        String orderBy = switch (sort != null ? sort : "") {
            case "price-low" -> " ORDER BY pp.price ASC NULLS LAST";
            case "price-high" -> " ORDER BY pp.price DESC NULLS LAST";
            case "rating" -> " ORDER BY p.ratingAvg DESC NULLS LAST";
            case "orders" -> " ORDER BY p.popularityRank ASC NULLS LAST";
            default -> " ORDER BY p.createdAt DESC";
        };

        String countJpql = "SELECT COUNT(DISTINCT p.id) " + from + " WHERE " + whereClause;
        TypedQuery<Long> countQuery = entityManager.createQuery(countJpql, Long.class);
        params.forEach(countQuery::setParameter);
        long total = countQuery.getSingleResult();

        String selectJpql = "SELECT DISTINCT p " + from + " WHERE " + whereClause + orderBy;
        TypedQuery<ProductEntity> dataQuery = entityManager.createQuery(selectJpql, ProductEntity.class);
        params.forEach(dataQuery::setParameter);
        int safeLimit = Math.max(limit, 1);
        dataQuery.setFirstResult(Math.max(page - 1, 0) * safeLimit);
        dataQuery.setMaxResults(safeLimit);
        List<ProductEntity> products = dataQuery.getResultList();

        int totalPages = (int) Math.ceil((double) total / safeLimit);

        ProductDtos.ProductListResponseDto res = new ProductDtos.ProductListResponseDto();
        res.setProducts(products.stream().map(ProductMapper::toProductDto).toList());
        res.setTotal(total);
        res.setPage(page);
        res.setTotalPages(totalPages);
        return res;
    }

    public ProductDtos.ProductDetailResponseDto getProduct(String rawProductId) {
        ProductEntity product = resolveProduct(rawProductId);
        if (!isPublicCatalogProduct(product)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found");
        }
        List<ProductTagEntity> tagLinks = productTagRepository.findByProductId(product.getId());
        List<Integer> tagIds = tagLinks.stream().map(ProductTagEntity::getTagId).toList();
        List<TagEntity> tags = tagIds.isEmpty() ? List.of()
                : entityManager.createQuery("SELECT t FROM TagEntity t WHERE t.id IN :ids ORDER BY t.sortOrder", TagEntity.class)
                        .setParameter("ids", tagIds).getResultList();
        List<ProductReviewEntity> reviews = reviewRepository.findByProductIdAndStatus(product.getId(), ReviewStatus.approved.name());
        return ProductMapper.toProductDetail(product, tags, reviews);
    }

    private boolean isPublicCatalogProduct(ProductEntity p) {
        if (p == null) return false;
        return "active".equalsIgnoreCase(p.getStatus());
    }

    private ProductEntity resolveProduct(String rawId) {
        if (rawId == null || rawId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found");
        }

        String id = rawId.trim();
        try {
            id = URLDecoder.decode(id, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ignored) {
        }

        id = id.replace("/", "").trim();
        if (id.toUpperCase(Locale.ROOT).startsWith("PRD-")) {
            id = id.substring(4).trim();
        }

        Optional<ProductEntity> direct = productRepository.findById(id);
        if (direct.isPresent()) {
            return direct.get();
        }

        if (id.length() >= 6) {
            List<ProductEntity> bySuffix = findProductsByIdSuffix(id);
            if (!bySuffix.isEmpty()) {
                return bySuffix.get(0);
            }
        }

        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found");
    }

    private List<ProductEntity> findProductsByIdSuffix(String suffix) {
        String pattern = "%" + suffix.toLowerCase();
        TypedQuery<ProductEntity> q = entityManager.createQuery(
                "SELECT p FROM ProductEntity p WHERE LOWER(p.id) LIKE :pattern", ProductEntity.class);
        q.setParameter("pattern", pattern);
        q.setMaxResults(5);
        return q.getResultList();
    }
}
