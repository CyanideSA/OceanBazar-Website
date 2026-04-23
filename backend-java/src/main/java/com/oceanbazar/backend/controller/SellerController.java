package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.entity.SellerEntity;
import com.oceanbazar.backend.security.AuthTokenService;
import com.oceanbazar.backend.service.SellerService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/sellers")
@RequiredArgsConstructor
public class SellerController {
    private final SellerService sellerService;
    private final AuthTokenService authTokenService;

    @GetMapping("/{id}")
    public SellerEntity getPublicProfile(@PathVariable String id) {
        SellerEntity seller = sellerService.getById(id);
        seller.setPayoutAccount(null);
        seller.setTaxId(null);
        seller.setRegistrationNumber(null);
        return seller;
    }

    @PostMapping("/register")
    public SellerEntity register(@RequestBody SellerEntity seller) {
        return sellerService.register(seller);
    }

    @PutMapping("/{id}")
    public SellerEntity updateProfile(@RequestHeader(value = "Authorization", required = false) String authorization,
                                @PathVariable String id,
                                @RequestBody SellerEntity updates) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return sellerService.updateProfile(id, updates, userId);
    }
}
