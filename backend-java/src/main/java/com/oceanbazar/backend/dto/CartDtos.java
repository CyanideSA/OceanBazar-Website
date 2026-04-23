package com.oceanbazar.backend.dto;

import lombok.Data;

import java.util.List;
import java.util.Map;

public class CartDtos {
    @Data
    public static class CartItemDto {
        private String id;
        private Map<String, Object> product;
        private int quantity;
        private double price;
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

