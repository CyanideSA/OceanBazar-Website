package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.entity.BusinessInquiryEntity;
import com.oceanbazar.backend.repository.BusinessInquiryRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping({"/api/business-inquiry", "/api/partner-requests"})
@RequiredArgsConstructor
public class BusinessInquiryController {
    private final BusinessInquiryRepository businessInquiryRepository;

    @PostMapping("")
    public Map<String, Object> submitInquiry(@Valid @RequestBody BusinessInquiryRequest request) {
        BusinessInquiryEntity inquiry = new BusinessInquiryEntity();
        inquiry.setFullName(request.getFullName());
        inquiry.setBusinessName(request.getBusinessName());
        inquiry.setEmail(request.getEmail());
        inquiry.setPhone(request.getPhone());
        inquiry.setBusinessType(request.getBusinessType());
        inquiry.setCountry(request.getCountry());
        inquiry.setMessage(request.getMessage());
        inquiry.setStatus("pending");
        Instant n = Instant.now();
        inquiry.setCreatedAt(n);
        inquiry.setUpdatedAt(n);
        businessInquiryRepository.save(inquiry);

        return Map.of(
                "success", true,
                "message", "Thank you for your inquiry. Our team will contact you within 24-48 hours."
        );
    }

    @Data
    public static class BusinessInquiryRequest {
        @NotBlank
        private String fullName;
        @NotBlank
        private String businessName;
        @Email
        private String email;
        @NotBlank
        private String phone;
        @NotBlank
        private String businessType;
        @NotBlank
        private String country;
        @NotBlank
        private String message;
    }
}
