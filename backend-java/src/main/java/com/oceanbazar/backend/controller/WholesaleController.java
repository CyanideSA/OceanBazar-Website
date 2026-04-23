package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.entity.WholesaleApplicationEntity;
import com.oceanbazar.backend.repository.WholesaleApplicationRepository;
import com.oceanbazar.backend.security.AuthTokenService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/wholesale")
@RequiredArgsConstructor
public class WholesaleController {
    private final WholesaleApplicationRepository wholesaleApplicationRepository;
    private final AuthTokenService authTokenService;

    @PostMapping("/apply")
    public Map<String, Object> submitApplication(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody WholesaleApplicationRequest request
    ) {
        if (authorization == null || authorization.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required to apply for wholesale");
        }
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        if (userId == null || userId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required to apply for wholesale");
        }
        WholesaleApplicationEntity existing = wholesaleApplicationRepository
                .findFirstByUserIdAndStatusIn(userId, List.of("pending", "approved"))
                .orElse(null);

        if (existing != null) {
            if ("approved".equals(existing.getStatus())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You already have an approved wholesale account");
            }
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You already have a pending application");
        }

        WholesaleApplicationEntity app = new WholesaleApplicationEntity();
        app.setId(UUID.randomUUID().toString());
        app.setUserId(userId);
        app.setBusinessName(request.getBusinessName());
        app.setBusinessType(request.getBusinessType());
        app.setTaxId(request.getTaxId());
        app.setContactPerson(request.getContactPerson());
        app.setEmail(request.getEmail());
        app.setPhone(request.getPhone());
        app.setAddress(request.getAddress());
        app.setBusinessDescription(request.getBusinessDescription());
        app.setExpectedVolume(request.getExpectedVolume());
        app.setStatus("pending");
        Instant n = Instant.now();
        app.setCreatedAt(n);
        app.setUpdatedAt(n);
        wholesaleApplicationRepository.save(app);

        return Map.of(
                "success", true,
                "message", "Application submitted successfully. We will review within 2-3 business days."
        );
    }

    @GetMapping("/application-status")
    public Map<String, Object> getApplicationStatus(@RequestHeader(value = "Authorization", required = false) String authorization) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        WholesaleApplicationEntity application = wholesaleApplicationRepository.findFirstByUserIdOrderByCreatedAtDesc(userId).orElse(null);
        if (application == null) {
            return Map.of("hasApplication", false);
        }

        return Map.of(
                "hasApplication", true,
                "status", application.getStatus(),
                "submittedAt", application.getCreatedAt(),
                "businessName", application.getBusinessName()
        );
    }

    @Data
    public static class WholesaleApplicationRequest {
        @NotBlank
        private String businessName;
        @NotBlank
        private String businessType;
        private String taxId;
        @NotBlank
        private String contactPerson;
        @Email
        private String email;
        @NotBlank
        private String phone;
        @NotBlank
        private String address;
        @NotBlank
        private String businessDescription;
        @NotBlank
        private String expectedVolume;
    }
}
