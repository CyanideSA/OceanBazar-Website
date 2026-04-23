package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.dto.PaymentMethodDtos;
import com.oceanbazar.backend.security.AuthTokenService;
import com.oceanbazar.backend.service.SavedPaymentMethodService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/profile/payment-methods")
@RequiredArgsConstructor
public class CustomerPaymentMethodController {

    private final AuthTokenService authTokenService;
    private final SavedPaymentMethodService savedPaymentMethodService;

    @GetMapping("")
    public PaymentMethodDtos.ListResponse list(@RequestHeader(value = "Authorization", required = false) String authorization) {
        String userId = requireUserId(authorization);
        return savedPaymentMethodService.list(userId);
    }

    @PostMapping("")
    public PaymentMethodDtos.PaymentMethodResponse add(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody PaymentMethodDtos.CreateRequest body
    ) {
        String userId = requireUserId(authorization);
        if (body == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body required");
        }
        return savedPaymentMethodService.add(userId, body);
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable String id
    ) {
        String userId = requireUserId(authorization);
        if (id == null || id.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment method id required");
        }
        savedPaymentMethodService.delete(userId, id);
        return Map.of("success", true);
    }

    @PatchMapping("/{id}/default")
    public PaymentMethodDtos.PaymentMethodResponse setDefault(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable String id
    ) {
        String userId = requireUserId(authorization);
        if (id == null || id.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment method id required");
        }
        return savedPaymentMethodService.setDefault(userId, id);
    }

    private String requireUserId(String authorization) {
        try {
            return authTokenService.getUserIdFromAuthorization(authorization);
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid authentication credentials");
        }
    }
}
