package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.OrderDtos;
import com.oceanbazar.backend.dto.ProfileDtos;
import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.ReturnRequestEntity;
import com.oceanbazar.backend.entity.UserEntity;
import com.oceanbazar.backend.mapper.OrderMapper;
import com.oceanbazar.backend.repository.OrderRepository;
import com.oceanbazar.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class CustomerProfileService {
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final CustomerReturnOrchestrationService customerReturnOrchestrationService;
    private final LocalFileStorageService localFileStorageService;

    public ProfileDtos.ProfileResponseDto me(String userId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        return toProfile(user);
    }

    public ProfileDtos.ProfileResponseDto update(String userId, UserEntity payload) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (payload == null) return toProfile(user);

        if (payload.getName() != null) user.setName(payload.getName());
        if (payload.getEmail() != null && !payload.getEmail().isBlank()) {
            String newEmail = payload.getEmail().trim();
            if (!newEmail.equalsIgnoreCase(user.getEmail()) && userRepository.existsByEmail(newEmail)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already in use");
            }
            user.setEmail(newEmail);
        }

        if (payload.getPhone() != null) user.setPhone(payload.getPhone());

        userRepository.save(user);
        return toProfile(user);
    }

    public ProfileDtos.ProfileResponseDto uploadPhoto(String userId, MultipartFile file) throws java.io.IOException {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File required");
        }
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        user.setProfileImage(localFileStorageService.store(file));
        userRepository.save(user);
        return toProfile(user);
    }

    public ProfileDtos.MyOrdersResponseDto myOrders(String userId) {
        java.util.List<OrderEntity> orders = orderRepository.findByUserIdOrderByCreatedAtDesc(userId);
        java.util.List<OrderDtos.OrderResponseDto> dtos = orders.stream()
                .map(OrderMapper::toOrderResponse)
                .toList();
        ProfileDtos.MyOrdersResponseDto res = new ProfileDtos.MyOrdersResponseDto();
        res.setOrders(dtos);
        return res;
    }

    public ProfileDtos.ReturnRequestResponseDto requestReturn(String userId, String orderId, Map<String, String> body) {
        String reason = body == null ? null : body.get("reason");
        ReturnRequestEntity saved = customerReturnOrchestrationService.submitCustomerReturn(userId, orderId, reason, null);

        ProfileDtos.ReturnRequestResponseDto res = new ProfileDtos.ReturnRequestResponseDto();
        res.setSuccess(true);
        res.setReturnStatus("requested");
        res.setReturnRequestId(saved.getId());
        res.setDisputeId(saved.getDisputeId());
        return res;
    }

    private ProfileDtos.ProfileResponseDto toProfile(UserEntity user) {
        ProfileDtos.ProfileResponseDto out = new ProfileDtos.ProfileResponseDto();
        out.setId(user.getId());
        out.setName(user.getName());
        out.setEmail(user.getEmail());
        out.setUserType(user.getUserType() != null ? user.getUserType().name() : null);
        out.setPhone(user.getPhone());
        out.setProfileImageUrl(user.getProfileImage());
        return out;
    }
}
