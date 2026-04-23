package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.dto.ReviewDtos;
import com.oceanbazar.backend.entity.ProductReviewEntity;
import com.oceanbazar.backend.security.AuthTokenService;
import com.oceanbazar.backend.service.ReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class CustomerReviewController {
    private final ReviewService reviewService;
    private final AuthTokenService authTokenService;

    @GetMapping("/product/{productId}")
    public List<ProductReviewEntity> getProductReviews(@PathVariable String productId) {
        return reviewService.getProductReviews(productId);
    }

    @PostMapping
    public ProductReviewEntity submitReview(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody ReviewDtos.SubmitReviewRequest body
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return reviewService.submitReview(body, userId);
    }

    @PostMapping("/{id}/helpful")
    public ProductReviewEntity markHelpful(@RequestHeader(value = "Authorization", required = false) String authorization,
                              @PathVariable String id) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return reviewService.markHelpful(id, userId);
    }
}
