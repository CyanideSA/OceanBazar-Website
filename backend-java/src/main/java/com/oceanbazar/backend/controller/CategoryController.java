package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.dto.CategoryResponse;
import com.oceanbazar.backend.entity.CategoryEntity;
import com.oceanbazar.backend.repository.CategoryRepository;
import com.oceanbazar.backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {
    private final CategoryRepository categoryRepository;
    private final ProductRepository productRepository;

    @GetMapping("")
    public List<CategoryResponse> getCategories(@RequestParam(defaultValue = "true") boolean tree) {
        List<CategoryEntity> categories = categoryRepository.findAll(Sort.by(Sort.Direction.ASC, "sortOrder", "nameEn"));

        Map<String, CategoryResponse> responseMap = new LinkedHashMap<>();
        for (CategoryEntity cat : categories) {
            CategoryResponse r = new CategoryResponse();
            r.setId(cat.getId());
            r.setName(cat.getNameEn());
            r.setNameEn(cat.getNameEn());
            r.setNameBn(cat.getNameBn());
            r.setSlug(cat.getSlug());
            r.setIcon(cat.getIcon());
            r.setParentId(cat.getParentId());
            r.setLeaf(cat.getIsLeaf() != null && cat.getIsLeaf());
            r.setCount(productRepository.countByCategoryId(cat.getId()));
            responseMap.put(cat.getId(), r);
        }

        if (!tree) {
            return new ArrayList<>(responseMap.values());
        }

        List<CategoryResponse> roots = new ArrayList<>();
        for (CategoryResponse r : responseMap.values()) {
            if (r.getParentId() == null || r.getParentId().isBlank()) {
                roots.add(r);
            } else {
                CategoryResponse parent = responseMap.get(r.getParentId());
                if (parent != null) {
                    parent.getChildren().add(r);
                } else {
                    roots.add(r);
                }
            }
        }

        for (CategoryResponse root : roots) {
            propagateChildCounts(root);
        }

        return roots;
    }

    private void propagateChildCounts(CategoryResponse node) {
        for (CategoryResponse child : node.getChildren()) {
            propagateChildCounts(child);
            node.setCount(node.getCount() + child.getCount());
        }
    }

}
