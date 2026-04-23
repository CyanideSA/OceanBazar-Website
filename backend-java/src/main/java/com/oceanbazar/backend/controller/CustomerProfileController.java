package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.entity.UserEntity;
import com.oceanbazar.backend.dto.ProfileDtos;
import com.oceanbazar.backend.security.AuthTokenService;
import com.oceanbazar.backend.service.CustomerProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.Map;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class CustomerProfileController {
    private final AuthTokenService authTokenService;
    private final CustomerProfileService customerProfileService;

    @GetMapping("")
    public ProfileDtos.ProfileResponseDto me(@RequestHeader(value = "Authorization", required = false) String authorization) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return customerProfileService.me(userId);
    }

    @PutMapping("")
    public ProfileDtos.ProfileResponseDto update(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody UserEntity payload
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return customerProfileService.update(userId, payload);
    }

    @PostMapping(value = "/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ProfileDtos.ProfileResponseDto uploadPhoto(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestParam("file") MultipartFile file
    ) throws java.io.IOException {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return customerProfileService.uploadPhoto(userId, file);
    }

    @GetMapping("/orders")
    public ProfileDtos.MyOrdersResponseDto myOrders(@RequestHeader(value = "Authorization", required = false) String authorization) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return customerProfileService.myOrders(userId);
    }

    @PostMapping("/orders/{orderId}/return-request")
    public ProfileDtos.ReturnRequestResponseDto requestReturn(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @PathVariable String orderId,
            @RequestBody(required = false) Map<String, String> body
    ) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return customerProfileService.requestReturn(userId, orderId, body);
    }
}
