package com.oceanbazar.backend.checkout;

import com.oceanbazar.backend.security.AuthTokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/checkout")
@RequiredArgsConstructor
public class CheckoutController {

    private final AuthTokenService authTokenService;
    private final CheckoutFacadeService checkoutFacadeService;

    @PostMapping("/validate")
    public Map<String, Object> validate(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody CheckoutFacadeService.CheckoutValidateRequest body
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return checkoutFacadeService.validateCheckout(userId, body);
    }
}
