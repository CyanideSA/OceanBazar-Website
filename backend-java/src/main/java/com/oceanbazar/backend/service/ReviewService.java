package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.ReviewDtos;
import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.OrderItemEntity;
import com.oceanbazar.backend.entity.ProductEntity;
import com.oceanbazar.backend.entity.ProductReviewEntity;
import com.oceanbazar.backend.entity.enums.ReviewStatus;
import com.oceanbazar.backend.repository.OrderRepository;
import com.oceanbazar.backend.repository.ReviewRepository;
import com.oceanbazar.backend.repository.ProductRepository;
import com.oceanbazar.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReviewService {
    private final ReviewRepository reviewRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;

    public List<ProductReviewEntity> getProductReviews(String productId) {
        return reviewRepository.findByProductIdAndStatus(productId, ReviewStatus.approved.name());
    }

    /** Admin: all reviews for a product (pending, approved, rejected, etc.). */
    public List<ProductReviewEntity> getProductReviewsForAdmin(String productId) {
        if (productId == null || productId.isBlank()) {
            return List.of();
        }
        return reviewRepository.findByProductId(productId.trim()).stream()
                .sorted(Comparator.comparing(ProductReviewEntity::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .toList();
    }

    public List<ProductReviewEntity> getPendingReviews() {
        return reviewRepository.findByStatus(ReviewStatus.pending.name());
    }

    public ProductReviewEntity submitReview(ReviewDtos.SubmitReviewRequest req, String authenticatedUserId) {
        if (authenticatedUserId == null || authenticatedUserId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        if (req == null || req.getProductId() == null || req.getProductId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "productId is required");
        }
        String productId = req.getProductId().trim();
        productRepository.findById(productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found"));
        if (reviewRepository.existsByUserIdAndProductId(authenticatedUserId, productId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You have already reviewed this product");
        }

        ProductReviewEntity review = new ProductReviewEntity();
        review.setProductId(productId);
        review.setUserId(authenticatedUserId);
        review.setRating(req.getRating());
        String title = req.getTitle() == null ? "" : req.getTitle().trim();
        review.setTitle(title.isEmpty() ? "Product review" : title);
        review.setBody(req.getComment().trim());

        String orderId = req.getOrderId() == null ? null : req.getOrderId().trim();
        if (orderId != null && !orderId.isBlank()) {
            OrderEntity order = orderRepository.findById(orderId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Order not found for verification"));
            if (!authenticatedUserId.equals(order.getUserId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Order does not belong to you");
            }
            if (!orderContainsProduct(order, productId)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This product is not part of that order");
            }
            review.setOrderId(orderId);
        }

        review.setStatus(ReviewStatus.pending);
        review.setCreatedAt(Instant.now());
        review.setUpdatedAt(Instant.now());
        ProductReviewEntity saved = reviewRepository.save(review);
        recalculateProductRating(productId);
        return saved;
    }

    private static boolean orderContainsProduct(OrderEntity order, String productId) {
        List<OrderItemEntity> items = order.getItems();
        if (items == null) {
            return false;
        }
        return items.stream().anyMatch(item -> productId.equals(item.getProductId()));
    }

    public ProductReviewEntity moderateReview(String reviewId, String status, String note, String adminId) {
        ProductReviewEntity review = reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found"));
        review.setStatus(ReviewStatus.valueOf(status));
        review.setUpdatedAt(Instant.now());
        ProductReviewEntity saved = reviewRepository.save(review);
        recalculateProductRating(review.getProductId());
        return saved;
    }

    public ProductReviewEntity markHelpful(String reviewId, String authenticatedUserId) {
        if (authenticatedUserId == null || authenticatedUserId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required");
        }
        return reviewRepository.findById(reviewId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review not found"));
    }

    private void recalculateProductRating(String productId) {
        List<ProductReviewEntity> approved = reviewRepository.findByProductIdAndStatus(productId, ReviewStatus.approved.name());
        if (approved.isEmpty()) return;
        double avg = approved.stream()
                .filter(r -> r.getRating() != null)
                .mapToInt(ProductReviewEntity::getRating)
                .average()
                .orElse(0.0);
        productRepository.findById(productId).ifPresent(p -> {
            p.setRatingAvg(BigDecimal.valueOf(avg).setScale(2, RoundingMode.HALF_UP));
            p.setReviewCount(approved.size());
            productRepository.save(p);
        });
    }
}
