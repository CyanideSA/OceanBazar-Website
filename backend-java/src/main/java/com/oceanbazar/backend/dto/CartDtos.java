package com.oceanbazar.backend.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

public class CartDtos {
    @Data
    public static class CartItemDto {
        private String id;
        private String productId;
        private String variantId;
        /** e.g. "Color: silver · Style: matte" */
        private String variantLabel;
        private Map<String, String> variantAttributes;
        private Map<String, Object> product;
        private int quantity;
        private double price;
        private double unitPrice;
        private String title;
        private String image;
    }

    @Data
    public static class CartResponseDto {
        private List<CartItemDto> items;
        private Double subtotal;
        private Double shipping;
        private Double gst;
        private Double serviceFee;
        private Double total;
    }
}

