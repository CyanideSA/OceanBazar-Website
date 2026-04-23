package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.CatalogDtos.*;
import com.oceanbazar.backend.entity.*;
import com.oceanbazar.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CatalogSearchService {
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;
    private final TagRepository tagRepository;
    private final ProductExplorerService productExplorerService;

    public SearchResult search(String query) {
        if (query == null || query.isBlank()) {
            return SearchResult.builder()
                    .categories(List.of())
                    .products(List.of())
                    .tags(List.of())
                    .build();
        }
        String q = query.trim();

        List<CategoryTreeNode> categories = categoryRepository.searchByName(q).stream()
                .limit(20)
                .map(c -> CategoryTreeNode.builder()
                        .id(c.getId())
                        .parentId(c.getParentId())
                        .nameEn(c.getNameEn())
                        .nameBn(c.getNameBn())
                        .slug(c.getSlug())
                        .icon(c.getIcon())
                        .depth(c.getDepth())
                        .path(c.getPath())
                        .isLeaf(c.getIsLeaf())
                        .build())
                .collect(Collectors.toList());

        List<ProductSummary> products = productRepository.searchByTitle(q).stream()
                .limit(50)
                .map(productExplorerService::toSummary)
                .collect(Collectors.toList());

        List<TagDto> tags = tagRepository.searchByName(q).stream()
                .limit(20)
                .map(t -> TagDto.builder()
                        .id(t.getId())
                        .nameEn(t.getNameEn())
                        .nameBn(t.getNameBn())
                        .slug(t.getSlug())
                        .build())
                .collect(Collectors.toList());

        return SearchResult.builder()
                .categories(categories)
                .products(products)
                .tags(tags)
                .build();
    }
}
