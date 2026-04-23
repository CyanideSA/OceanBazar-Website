package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.dto.PaymentDtos;
import com.oceanbazar.backend.service.PaymentService;
import com.oceanbazar.backend.security.AuthTokenService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {
    private final AuthTokenService authTokenService;
    private final PaymentService paymentService;

    @PostMapping("/placeholder")
    public Map<String, Object> authorizePlaceholder(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody PaymentDtos.PaymentPlaceholderRequest request
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return paymentService.authorizePlaceholder(userId, request);
    }

    @PostMapping("/bkash/placeholder")
    public Map<String, Object> authorizeBkash(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody PaymentDtos.PaymentOrderIdRequest request
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        PaymentDtos.PaymentPlaceholderRequest placeholder = new PaymentDtos.PaymentPlaceholderRequest();
        placeholder.setOrderId(request.getOrderId());
        placeholder.setPaymentMethod("bkash");
        return paymentService.authorizePlaceholder(userId, placeholder);
    }

    /** /bkash/initiate — storefront calls this route */
    @PostMapping("/bkash/initiate")
    public Map<String, Object> initiateBkash(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody PaymentDtos.PaymentOrderIdRequest request
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        PaymentDtos.PaymentPlaceholderRequest placeholder = new PaymentDtos.PaymentPlaceholderRequest();
        placeholder.setOrderId(request.getOrderId());
        placeholder.setPaymentMethod("bkash");
        return paymentService.authorizePlaceholder(userId, placeholder);
    }

    @PostMapping("/nagad/placeholder")
    public Map<String, Object> authorizeNagad(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody PaymentDtos.PaymentOrderIdRequest request
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        PaymentDtos.PaymentPlaceholderRequest placeholder = new PaymentDtos.PaymentPlaceholderRequest();
        placeholder.setOrderId(request.getOrderId());
        placeholder.setPaymentMethod("nagad");
        return paymentService.authorizePlaceholder(userId, placeholder);
    }

    /** /nagad/initiate — storefront calls this route */
    @PostMapping("/nagad/initiate")
    public Map<String, Object> initiateNagad(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody PaymentDtos.PaymentOrderIdRequest request
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        PaymentDtos.PaymentPlaceholderRequest placeholder = new PaymentDtos.PaymentPlaceholderRequest();
        placeholder.setOrderId(request.getOrderId());
        placeholder.setPaymentMethod("nagad");
        return paymentService.authorizePlaceholder(userId, placeholder);
    }

    /** /rocket/initiate */
    @PostMapping("/rocket/initiate")
    public Map<String, Object> initiateRocket(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody PaymentDtos.PaymentOrderIdRequest request
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        PaymentDtos.PaymentPlaceholderRequest placeholder = new PaymentDtos.PaymentPlaceholderRequest();
        placeholder.setOrderId(request.getOrderId());
        placeholder.setPaymentMethod("rocket");
        return paymentService.authorizePlaceholder(userId, placeholder);
    }

    /** /upay/initiate */
    @PostMapping("/upay/initiate")
    public Map<String, Object> initiateUpay(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody PaymentDtos.PaymentOrderIdRequest request
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        PaymentDtos.PaymentPlaceholderRequest placeholder = new PaymentDtos.PaymentPlaceholderRequest();
        placeholder.setOrderId(request.getOrderId());
        placeholder.setPaymentMethod("upay");
        return paymentService.authorizePlaceholder(userId, placeholder);
    }

    /** Placeholder success path until SSLCOMMERZ session/init + IPN handlers are implemented. */
    @PostMapping("/sslcommerz/placeholder")
    public Map<String, Object> authorizeSslCommerz(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody PaymentDtos.PaymentOrderIdRequest request
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        PaymentDtos.PaymentPlaceholderRequest placeholder = new PaymentDtos.PaymentPlaceholderRequest();
        placeholder.setOrderId(request.getOrderId());
        placeholder.setPaymentMethod("sslcommerz");
        return paymentService.authorizePlaceholder(userId, placeholder);
    }

    /** /sslcommerz/initiate — storefront calls this route */
    @PostMapping("/sslcommerz/initiate")
    public Map<String, Object> initiateSslCommerz(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody PaymentDtos.PaymentOrderIdRequest request
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        PaymentDtos.PaymentPlaceholderRequest placeholder = new PaymentDtos.PaymentPlaceholderRequest();
        placeholder.setOrderId(request.getOrderId());
        placeholder.setPaymentMethod("sslcommerz");
        return paymentService.authorizePlaceholder(userId, placeholder);
    }
}

