package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.entity.ReturnRequestEntity;
import com.oceanbazar.backend.security.AuthTokenService;
import com.oceanbazar.backend.service.ReturnService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/returns")
@RequiredArgsConstructor
public class CustomerReturnController {
    private final ReturnService returnService;
    private final AuthTokenService authTokenService;

    @GetMapping("/user/me")
    public List<ReturnRequestEntity> getMyReturns(@RequestHeader(value = "Authorization", required = false) String authorization) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return returnService.listByUser(userId);
    }

    @GetMapping("/user/{userId}")
    public List<ReturnRequestEntity> getUserReturns(@RequestHeader(value = "Authorization", required = false) String authorization,
                                              @PathVariable String userId) {
        String authId = authTokenService.getUserIdFromAuthorization(authorization);
        if (!authId.equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not allowed");
        }
        return returnService.listByUser(userId);
    }

    @GetMapping("/{id}")
    public ReturnRequestEntity getById(@RequestHeader(value = "Authorization", required = false) String authorization,
                                 @PathVariable String id) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return returnService.getByIdForUser(id, userId);
    }

    @PostMapping
    public ReturnRequestEntity create(@RequestHeader(value = "Authorization", required = false) String authorization,
                                @RequestBody ReturnRequestEntity request) {
        String userId = authTokenService.getUserIdFromAuthorization(authorization);
        return returnService.create(request, userId);
    }
}
