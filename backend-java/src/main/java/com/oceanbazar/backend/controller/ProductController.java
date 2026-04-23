package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.dto.ProductDtos;
import com.oceanbazar.backend.service.ProductQueryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {
    private final ProductQueryService productQueryService;

    @GetMapping("")
    public ProductDtos.ProductListResponseDto getProducts(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String categories,
            @RequestParam(required = false) Boolean featuredSale,
            @RequestParam(required = false) Double minPrice,
            @RequestParam(required = false) Double maxPrice,
            @RequestParam(required = false) Boolean verified,
            @RequestParam(required = false) String brand,
            @RequestParam(required = false) Double minRating,
            @RequestParam(defaultValue = "relevance") String sort,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "12") int limit
    ) {
        return productQueryService.getProducts(search, category, categories, featuredSale, minPrice, maxPrice, verified, brand, minRating, sort, page, limit);
    }

    @GetMapping("/{productId}")
    public ProductDtos.ProductDetailResponseDto getProduct(@PathVariable String productId) {
        return productQueryService.getProduct(productId);
    }
}
