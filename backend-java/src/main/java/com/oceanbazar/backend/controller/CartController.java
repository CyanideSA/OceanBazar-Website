package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.dto.CartDtos;
import com.oceanbazar.backend.security.AuthTokenService;
import com.oceanbazar.backend.service.CartService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
public class CartController {
    private final AuthTokenService authTokenService;
    private final CartService cartService;

    @GetMapping("")
    public CartDtos.CartResponseDto getCart(@RequestHeader(value = "Authorization", required = false) String authorization) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return cartService.getCart(userId);
    }

    @PostMapping("/add")
    public CartDtos.CartResponseDto addToCart(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody AddToCartRequest request
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return cartService.addToCart(userId, request.getProductId(), request.getQuantity());
    }

    @PutMapping("/update")
    public CartDtos.CartResponseDto updateCart(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody UpdateCartRequest request
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return cartService.updateCart(userId, request.getProductId(), request.getQuantity());
    }

    @DeleteMapping("/remove/{productId}")
    public CartDtos.CartResponseDto removeFromCart(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable String productId
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return cartService.removeFromCart(userId, productId);
    }

    @PostMapping("/reorder-from-order/{orderId}")
    public CartDtos.CartResponseDto reorderFromOrder(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable String orderId
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return cartService.reorderFromOrder(userId, orderId);
    }

    @Data
    public static class AddToCartRequest {
        @NotBlank
        private String productId;
        @Min(1)
        private Integer quantity = 1;
    }

    @Data
    public static class UpdateCartRequest {
        @NotBlank
        private String productId;
        @Min(0)
        private Integer quantity;
    }
}
