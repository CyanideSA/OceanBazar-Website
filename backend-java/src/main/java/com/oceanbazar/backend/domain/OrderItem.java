package com.oceanbazar.backend.domain;

import lombok.Data;

@Data
public class OrderItem {
    private String productId;
    private String name;
    private String category;
    private Double unitPrice;
    private Integer quantity;
    private Double lineTotal;
}

