package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.AdminCustomerDtos;
import com.oceanbazar.backend.entity.AdminUserEntity;
import com.oceanbazar.backend.entity.AuditLogEntity;
import com.oceanbazar.backend.entity.OrderEntity;
import com.oceanbazar.backend.entity.UserEntity;
import com.oceanbazar.backend.entity.enums.AccountStatus;
import com.oceanbazar.backend.entity.enums.AdminRole;
import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.repository.OrderRepository;
import com.oceanbazar.backend.repository.UserRepository;
import com.oceanbazar.backend.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
@RequiredArgsConstructor
public class AdminCustomerService {
    private final AdminUserRepository adminUserRepository;
    private final UserRepository userRepository;
    private final OrderRepository orderRepository;
    private final AuditLogRepository auditLogRepository;
    private final CustomerNotificationService customerNotificationService;

    public List<UserEntity> listCustomers() {
        return userRepository.findAll().stream().map(this::stripPassword).toList();
    }

    public UserEntity getCustomer(String id) {
        UserEntity user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Customer not found"));
        return stripPassword(user);
    }

    public List<OrderEntity> getCustomerOrders(String id) {
        if (!userRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Customer not found");
        }
        return orderRepository.findByUserIdOrderByCreatedAtDesc(id);
    }

    public UserEntity patchCustomerAccountStatus(String actorAdminId, String customerId, String status, String reason) {
        UserEntity user = userRepository.findById(customerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Customer not found"));

        String next = status == null ? "" : status.trim().toLowerCase();
        if (!Set.of("active", "suspended").contains(next)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status must be active or suspended");
        }
        user.setAccountStatus(AccountStatus.valueOf(next));
        userRepository.save(user);

        logAction(actorAdminId, "UPDATE_CUSTOMER_ACCOUNT_STATUS", "user", user.getId(),
                "status=" + next);

        String statusLabel = switch (next) {
            case "active" -> "active";
            case "suspended" -> "suspended";
            default -> next;
        };
        String msg = "Your account is now " + statusLabel + ".";
        customerNotificationService.notifyCustomer(user.getId(), "Account status updated", msg, "account", user.getId());

        return stripPassword(user);
    }

    /**
     * Updates customer contact/profile fields only.
     */
    public UserEntity updateCustomerProfile(String actorAdminId, String customerId, AdminCustomerDtos.AdminCustomerProfileUpdateRequest dto) {
        UserEntity user = userRepository.findById(customerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Customer not found"));

        String oldName = user.getName();
        String oldPhone = user.getPhone();

        String name = dto.getName() == null ? "" : dto.getName().trim();
        if (name.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name is required");
        }
        user.setName(name);

        String phone = dto.getPhone() == null ? null : dto.getPhone().trim();
        user.setPhone(phone == null || phone.isEmpty() ? null : phone);

        userRepository.save(user);

        StringBuilder details = new StringBuilder();
        if (!Objects.equals(oldName, user.getName())) {
            details.append("name: ").append(summarizeChange(oldName, user.getName())).append("; ");
        }
        if (!Objects.equals(oldPhone, user.getPhone())) {
            details.append("phone: ").append(summarizeChange(oldPhone, user.getPhone())).append("; ");
        }
        if (!details.isEmpty()) {
            logAction(actorAdminId, "UPDATE_CUSTOMER_PROFILE", "user", user.getId(), details.toString().trim());
            customerNotificationService.notifyCustomer(
                    user.getId(),
                    "Profile updated",
                    "Your contact details were updated by our team. If you did not expect this change, please contact support.",
                    "account",
                    user.getId()
            );
        }

        return stripPassword(user);
    }

    private static String summarizeChange(String before, String after) {
        String b = before == null || before.isBlank() ? "∅" : truncateForAudit(before, 80);
        String a = after == null || after.isBlank() ? "∅" : truncateForAudit(after, 80);
        return "\"" + b + "\"→\"" + a + "\"";
    }

    private static String truncateForAudit(String s, int max) {
        if (s.length() <= max) return s;
        return s.substring(0, max) + "…";
    }

    public Map<String, Object> deleteCustomer(String customerId) {
        if (!userRepository.existsById(customerId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Customer not found");
        }
        userRepository.deleteById(customerId);
        return Map.of("success", true);
    }

    private UserEntity stripPassword(UserEntity src) {
        if (src == null) return null;
        UserEntity out = new UserEntity();
        org.springframework.beans.BeanUtils.copyProperties(src, out);
        out.setPasswordHash(null);
        return out;
    }

    private void logAction(String adminId, String action, String targetType, String targetId, String details) {
        AuditLogEntity log = new AuditLogEntity();
        try {
            log.setAdminId(Integer.parseInt(adminId));
        } catch (NumberFormatException e) {
            log.setAdminId(0);
        }
        log.setAction(action);
        log.setTargetType(targetType);
        log.setTargetId(targetId);
        log.setDetails(details);
        auditLogRepository.save(log);
    }
}
