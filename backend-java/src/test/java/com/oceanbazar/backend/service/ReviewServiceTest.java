package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.ReviewDtos;
import com.oceanbazar.backend.entity.ProductEntity;
import com.oceanbazar.backend.entity.ProductReviewEntity;
import com.oceanbazar.backend.entity.enums.ReviewStatus;
import com.oceanbazar.backend.repository.OrderRepository;
import com.oceanbazar.backend.repository.ProductRepository;
import com.oceanbazar.backend.repository.ReviewRepository;
import com.oceanbazar.backend.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ReviewServiceTest {

    @Mock private ReviewRepository reviewRepository;
    @Mock private ProductRepository productRepository;
    @Mock private UserRepository userRepository;
    @Mock private OrderRepository orderRepository;

    @InjectMocks private ReviewService reviewService;

    @Test
    @DisplayName("submitReview saves and returns review")
    void submitReview_success() {
        ReviewDtos.SubmitReviewRequest req = new ReviewDtos.SubmitReviewRequest();
        req.setProductId("p1");
        req.setRating(5);
        req.setComment("Great product!");

        when(productRepository.findById("p1")).thenReturn(Optional.of(new ProductEntity()));
        when(reviewRepository.existsByUserIdAndProductId("u1", "p1")).thenReturn(false);
        when(reviewRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(reviewRepository.findByProductIdAndStatus("p1", "approved")).thenReturn(List.of());

        ProductReviewEntity result = reviewService.submitReview(req, "u1");

        assertEquals(ReviewStatus.pending, result.getStatus());
        verify(reviewRepository).save(any());
    }

    @Test
    @DisplayName("submitReview rejects duplicate review")
    void submitReview_duplicate() {
        ReviewDtos.SubmitReviewRequest req = new ReviewDtos.SubmitReviewRequest();
        req.setProductId("p1");
        req.setRating(4);
        req.setComment("Already reviewed");
        when(productRepository.findById("p1")).thenReturn(Optional.of(new ProductEntity()));
        when(reviewRepository.existsByUserIdAndProductId("u1", "p1")).thenReturn(true);

        assertThrows(ResponseStatusException.class, () -> reviewService.submitReview(req, "u1"));
    }

    @Test
    @DisplayName("moderateReview updates status")
    void moderateReview() {
        ProductReviewEntity review = new ProductReviewEntity();
        review.setId("r1");
        review.setProductId("p1");
        review.setStatus(ReviewStatus.pending);

        when(reviewRepository.findById("r1")).thenReturn(Optional.of(review));
        when(reviewRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(reviewRepository.findByProductIdAndStatus("p1", "approved")).thenReturn(List.of());

        ProductReviewEntity result = reviewService.moderateReview("r1", "approved", "Looks good", "admin-1");

        assertEquals(ReviewStatus.approved, result.getStatus());
    }
}
