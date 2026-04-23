package com.oceanbazar.backend.repository;

import com.oceanbazar.backend.entity.ProductReviewEntity;
import com.oceanbazar.backend.entity.enums.ReviewStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ReviewRepository extends JpaRepository<ProductReviewEntity, String> {
    @Query(value = "SELECT * FROM product_reviews WHERE product_id = :productId AND status = CAST(:status AS \"ReviewStatus\") ORDER BY created_at DESC", nativeQuery = true)
    List<ProductReviewEntity> findByProductIdAndStatus(@Param("productId") String productId, @Param("status") String status);

    List<ProductReviewEntity> findByProductId(String productId);
    List<ProductReviewEntity> findByUserId(String userId);

    @Query(value = "SELECT * FROM product_reviews WHERE status = CAST(:status AS \"ReviewStatus\") ORDER BY created_at DESC", nativeQuery = true)
    List<ProductReviewEntity> findByStatus(@Param("status") String status);

    Optional<ProductReviewEntity> findByUserIdAndProductId(String userId, String productId);
    boolean existsByUserIdAndProductId(String userId, String productId);

    @Query(value = "SELECT COUNT(*) FROM product_reviews WHERE product_id = :productId AND status = CAST(:status AS \"ReviewStatus\")", nativeQuery = true)
    long countByProductIdAndStatus(@Param("productId") String productId, @Param("status") String status);
}
