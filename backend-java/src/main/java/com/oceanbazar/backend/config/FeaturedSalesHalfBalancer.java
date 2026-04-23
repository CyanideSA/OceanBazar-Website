package com.oceanbazar.backend.config;

import com.oceanbazar.backend.entity.ProductEntity;
import com.oceanbazar.backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.data.domain.Sort;

import java.util.List;

/**
 * When enabled, marks roughly half of all products as featured for sale (stable order by id).
 * Set {@code app.balance-featured-sales-half=false} after the first successful run to avoid
 * overwriting future manual changes on every restart.
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class FeaturedSalesHalfBalancer {
    private final ProductRepository productRepository;

    @Value("${app.balance-featured-sales-half:false}")
    private boolean balanceFeaturedSalesHalf;

    @Bean
    @Order(Integer.MAX_VALUE)
    CommandLineRunner balanceFeaturedSalesHalfRunner() {
        return args -> {
            if (!balanceFeaturedSalesHalf) {
                return;
            }
            List<ProductEntity> all = productRepository.findAll(Sort.by(Sort.Direction.ASC, "id"));
            if (all.isEmpty()) {
                return;
            }
            int featuredCount = (all.size() + 1) / 2;
            for (int i = 0; i < all.size(); i++) {
                all.get(i).setIsFeatured(i < featuredCount);
            }
            productRepository.saveAll(all);
            log.info("Featured sales balanced: {} of {} products have isFeatured=true (app.balance-featured-sales-half)", featuredCount, all.size());
        };
    }
}
