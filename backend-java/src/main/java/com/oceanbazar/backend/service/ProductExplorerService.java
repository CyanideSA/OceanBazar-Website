package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.CatalogDtos.*;
import com.oceanbazar.backend.entity.*;
import com.oceanbazar.backend.entity.enums.AssetType;
import com.oceanbazar.backend.repository.*;
import com.oceanbazar.backend.utils.ShortId;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductExplorerService {
    private final ProductRepository productRepository;
    private final CategoryRepository categoryRepository;
    private final ProductAssetRepository assetRepository;
    private final ProductBannerRepository bannerRepository;
    private final ProductAttributeRepository attributeRepository;
    private final ProductTagRepository productTagRepository;
    private final TagRepository tagRepository;
    private final BrandRepository brandRepository;
    private final CategoryTreeService categoryTreeService;

    /** Get folder contents for a category (subfolders + products). */
    @Transactional(readOnly = true)
    public FolderContents getFolderContents(String categoryId, int page, int size) {
        CategoryEntity cat = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Category not found"));

        List<CategoryEntity> subCats = categoryRepository.findByParentIdOrderBySortOrderAscNameEnAsc(categoryId);
        List<CategoryTreeNode> subfolders = subCats.stream().map(sc -> CategoryTreeNode.builder()
                .id(sc.getId())
                .parentId(sc.getParentId())
                .nameEn(sc.getNameEn())
                .nameBn(sc.getNameBn())
                .slug(sc.getSlug())
                .icon(sc.getIcon())
                .sortOrder(sc.getSortOrder())
                .depth(sc.getDepth())
                .path(sc.getPath())
                .isLeaf(sc.getIsLeaf())
                .productCount(productRepository.countByCategoryId(sc.getId()))
                .childCount(categoryRepository.countByParentId(sc.getId()))
                .children(Collections.emptyList())
                .build()
        ).collect(Collectors.toList());

        Pageable pageable = PageRequest.of(Math.max(0, page - 1), size, Sort.by("titleEn").ascending());
        Page<ProductEntity> productPage = productRepository.findByCategoryId(categoryId, pageable);
        List<ProductSummary> products = productPage.getContent().stream()
                .map(this::toSummary)
                .collect(Collectors.toList());

        List<BreadcrumbItem> breadcrumb = categoryTreeService.getBreadcrumb(categoryId);

        return FolderContents.builder()
                .categoryId(cat.getId())
                .categoryName(cat.getNameEn())
                .path(cat.getPath())
                .breadcrumb(breadcrumb)
                .subfolders(subfolders)
                .products(products)
                .totalProducts(productPage.getTotalElements())
                .build();
    }

    /** Get root contents (top-level categories). */
    public FolderContents getRootContents() {
        List<CategoryEntity> roots = categoryRepository.findByParentIdIsNullOrderBySortOrderAscNameEnAsc();
        List<CategoryTreeNode> subfolders = roots.stream().map(sc -> CategoryTreeNode.builder()
                .id(sc.getId())
                .parentId(null)
                .nameEn(sc.getNameEn())
                .nameBn(sc.getNameBn())
                .slug(sc.getSlug())
                .icon(sc.getIcon())
                .sortOrder(sc.getSortOrder())
                .depth(0)
                .path(sc.getPath())
                .isLeaf(sc.getIsLeaf())
                .productCount(productRepository.countByCategoryId(sc.getId()))
                .childCount(categoryRepository.countByParentId(sc.getId()))
                .children(Collections.emptyList())
                .build()
        ).collect(Collectors.toList());

        return FolderContents.builder()
                .categoryId(null)
                .categoryName("Root")
                .path("/")
                .breadcrumb(Collections.emptyList())
                .subfolders(subfolders)
                .products(Collections.emptyList())
                .totalProducts(0)
                .build();
    }

    /** Full product detail */
    public ProductDetail getProductDetail(String productId) {
        ProductEntity p = productRepository.findById(productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));

        List<ProductAssetEntity> assets = assetRepository.findByProductIdOrderBySortOrderAsc(productId);
        List<ProductBannerEntity> banners = bannerRepository.findByProductIdOrderBySortOrderAsc(productId);
        List<ProductAttributeEntity> attrs = attributeRepository.findByProductIdOrderBySortOrderAsc(productId);
        List<ProductTagEntity> ptags = productTagRepository.findByProductId(productId);
        List<TagDto> tagDtos = ptags.stream().map(pt -> {
            TagEntity tag = tagRepository.findById(pt.getTagId()).orElse(null);
            if (tag == null) return null;
            return TagDto.builder()
                    .id(tag.getId())
                    .nameEn(tag.getNameEn())
                    .nameBn(tag.getNameBn())
                    .slug(tag.getSlug())
                    .build();
        }).filter(Objects::nonNull).collect(Collectors.toList());

        List<BreadcrumbItem> breadcrumb = categoryTreeService.getBreadcrumb(p.getCategoryId());

        return ProductDetail.builder()
                .id(p.getId())
                .titleEn(p.getTitleEn())
                .titleBn(p.getTitleBn())
                .descriptionEn(p.getDescriptionEn())
                .descriptionBn(p.getDescriptionBn())
                .categoryId(p.getCategoryId())
                .brandId(p.getBrandId())
                .brand(p.getBrand())
                .sellerId(p.getSellerId())
                .sku(p.getSku())
                .status(p.getStatus())
                .weight(p.getWeight())
                .weightUnit(p.getWeightUnit())
                .moq(p.getMoq())
                .stock(p.getStock())
                .seoTitle(p.getSeoTitle())
                .seoDescription(p.getSeoDescription())
                .isFeatured(p.getIsFeatured())
                .specifications(p.getSpecifications())
                .attributesExtra(p.getAttributesExtra())
                .ratingAvg(p.getRatingAvg())
                .reviewCount(p.getReviewCount())
                .brandLogoUrl(p.getBrandLogoUrl())
                .popularityRank(p.getPopularityRank())
                .popularityLabelEn(p.getPopularityLabelEn())
                .popularityLabelBn(p.getPopularityLabelBn())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .assets(assets.stream().map(a -> AssetDto.builder()
                        .id(a.getId())
                        .assetType(a.getAssetType().name())
                        .url(a.getUrl())
                        .altEn(a.getAltEn())
                        .altBn(a.getAltBn())
                        .sortOrder(a.getSortOrder())
                        .isPrimary(a.getIsPrimary())
                        .colorKey(a.getColorKey())
                        .build()).collect(Collectors.toList()))
                .banners(banners.stream().map(b -> BannerDto.builder()
                        .id(b.getId())
                        .productId(b.getProductId())
                        .categoryId(b.getCategoryId())
                        .imageUrl(b.getImageUrl())
                        .linkUrl(b.getLinkUrl())
                        .title(b.getTitle())
                        .placement(b.getPlacement())
                        .sortOrder(b.getSortOrder())
                        .rotationMs(b.getRotationMs())
                        .enabled(b.getEnabled())
                        .startsAt(b.getStartsAt())
                        .endsAt(b.getEndsAt())
                        .build()).collect(Collectors.toList()))
                .pricing(p.getPricing() != null ? p.getPricing().stream().map(pr -> PricingDto.builder()
                        .id(pr.getId())
                        .customerType(pr.getCustomerType())
                        .price(pr.getPrice())
                        .compareAt(pr.getCompareAt())
                        .tier1MinQty(pr.getTier1MinQty())
                        .tier1Discount(pr.getTier1Discount())
                        .tier2MinQty(pr.getTier2MinQty())
                        .tier2Discount(pr.getTier2Discount())
                        .tier3MinQty(pr.getTier3MinQty())
                        .tier3Discount(pr.getTier3Discount())
                        .build()).collect(Collectors.toList()) : Collections.emptyList())
                .variants(p.getVariants() != null ? p.getVariants().stream().map(v -> VariantDto.builder()
                        .id(v.getId())
                        .sku(v.getSku())
                        .nameEn(v.getNameEn())
                        .nameBn(v.getNameBn())
                        .attributes(v.getAttributes())
                        .priceOverride(v.getPriceOverride())
                        .stock(v.getStock())
                        .isActive(v.getIsActive())
                        .sortOrder(v.getSortOrder())
                        .build()).collect(Collectors.toList()) : Collections.emptyList())
                .attributes(attrs.stream().map(a -> AttributeDto.builder()
                        .id(a.getId())
                        .attrKey(a.getAttrKey())
                        .attrValue(a.getAttrValue())
                        .sortOrder(a.getSortOrder())
                        .build()).collect(Collectors.toList()))
                .tags(tagDtos)
                .breadcrumb(breadcrumb)
                .build();
    }

    /** Move product to a different category */
    @Transactional
    public ProductEntity moveProduct(String productId, String newCategoryId) {
        ProductEntity product = productRepository.findById(productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
        categoryRepository.findById(newCategoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Target category not found"));
        product.setCategoryId(newCategoryId);
        return productRepository.save(product);
    }

    /** Convert entity to summary DTO */
    @Transactional(readOnly = true)
    public ProductSummary toSummary(ProductEntity p) {
        String primaryImage = null;
        List<ProductAssetEntity> assets = assetRepository.findByProductIdOrderBySortOrderAsc(p.getId());
        for (ProductAssetEntity a : assets) {
            if (a.getIsPrimary() && a.getAssetType() == AssetType.image) {
                primaryImage = a.getUrl();
                break;
            }
        }
        if (primaryImage == null && !assets.isEmpty()) {
            primaryImage = assets.stream()
                    .filter(a -> a.getAssetType() == AssetType.image)
                    .findFirst()
                    .map(ProductAssetEntity::getUrl)
                    .orElse(null);
        }

        String brandName = null;
        if (p.getBrandId() != null) {
            brandName = brandRepository.findById(p.getBrandId())
                    .map(BrandEntity::getNameEn)
                    .orElse(p.getBrand());
        } else {
            brandName = p.getBrand();
        }

        java.math.BigDecimal retailPrice = null;
        java.math.BigDecimal wholesalePrice = null;
        if (p.getPricing() != null) {
            for (ProductPricingEntity pr : p.getPricing()) {
                if ("retail".equalsIgnoreCase(pr.getCustomerType())) retailPrice = pr.getPrice();
                if ("wholesale".equalsIgnoreCase(pr.getCustomerType())) wholesalePrice = pr.getPrice();
            }
        }

        return ProductSummary.builder()
                .id(p.getId())
                .titleEn(p.getTitleEn())
                .titleBn(p.getTitleBn())
                .sku(p.getSku())
                .status(p.getStatus())
                .stock(p.getStock())
                .moq(p.getMoq())
                .isFeatured(p.getIsFeatured())
                .primaryImage(primaryImage)
                .categoryId(p.getCategoryId())
                .brandId(p.getBrandId())
                .brandName(brandName)
                .retailPrice(retailPrice)
                .wholesalePrice(wholesalePrice)
                .createdAt(p.getCreatedAt())
                .build();
    }
}
