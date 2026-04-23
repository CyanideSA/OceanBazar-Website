package com.oceanbazar.backend.service;

import com.oceanbazar.backend.entity.AdminUserEntity;
import com.oceanbazar.backend.entity.AuditLogEntity;
import com.oceanbazar.backend.entity.enums.AdminRole;
import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AdminMemberService {
    private final AdminUserRepository adminUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditLogRepository auditLogRepository;

    public Map<String, Object> addMember(
            String actorAdminId,
            AdminRole actorRole,
            String name,
            String username,
            String email,
            String password,
            String role
    ) {
        if (actorAdminId == null || actorAdminId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing admin actor");
        }
        if (username == null || username.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "username is required");
        }
        String normalizedUsername = username.trim();

        AdminRole newRole = AdminRole.valueOf(role);
        assertActorMayAssign(actorRole, newRole);

        if (adminUserRepository.existsByUsername(normalizedUsername)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Username already in use");
        }

        AdminUserEntity admin = new AdminUserEntity();
        admin.setName(name);
        admin.setUsername(normalizedUsername);
        admin.setEmail(email);
        admin.setRole(newRole);
        admin.setPasswordHash(passwordEncoder.encode(password));
        admin.setActive(true);
        adminUserRepository.save(admin);

        logAction(actorAdminId, "CREATE_MEMBER", "admin_user", String.valueOf(admin.getId()), "role=" + admin.getRole());
        return Map.of("success", true, "id", admin.getId());
    }

    public Map<String, Object> updateMember(
            String actorAdminId,
            AdminRole actorRole,
            String memberId,
            String maybeName,
            String maybeEmail,
            String maybeRole,
            Boolean maybeActive
    ) {
        if (actorAdminId == null || actorAdminId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing admin actor");
        }

        AdminUserEntity member = adminUserRepository.findById(Integer.parseInt(memberId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Member not found"));

        AdminRole targetBefore = member.getRole();
        assertActorMayModifyTarget(actorRole, targetBefore);

        AdminRole newRole = targetBefore;
        if (maybeRole != null && !maybeRole.isBlank()) {
            newRole = AdminRole.valueOf(maybeRole);
            assertActorMayAssign(actorRole, newRole);
            assertActorMayModifyTarget(actorRole, newRole);
        }

        if (targetBefore == AdminRole.super_admin && newRole != AdminRole.super_admin && countActiveSuperAdmins() <= 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot change role of the last Super Admin");
        }
        if (Boolean.FALSE.equals(maybeActive) && targetBefore == AdminRole.super_admin && countActiveSuperAdmins() <= 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot deactivate the last Super Admin");
        }

        member.setName(maybeName == null ? member.getName() : maybeName);
        member.setEmail(maybeEmail == null ? member.getEmail() : maybeEmail);

        if (maybeRole != null && !maybeRole.isBlank()) {
            member.setRole(newRole);
        }
        if (maybeActive != null) {
            member.setActive(maybeActive);
        }

        adminUserRepository.save(member);
        logAction(actorAdminId, "UPDATE_MEMBER", "admin_user", String.valueOf(member.getId()), "role=" + member.getRole());
        return Map.of("success", true);
    }

    public Map<String, Object> deleteMember(String actorAdminId, AdminRole actorRole, String memberId) {
        if (actorAdminId == null || actorAdminId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing admin actor");
        }
        if (memberId.equals(actorAdminId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot delete your own account");
        }

        AdminUserEntity target = adminUserRepository.findById(Integer.parseInt(memberId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Member not found"));

        AdminRole targetRole = target.getRole();
        if (targetRole == AdminRole.super_admin && countActiveSuperAdmins() <= 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot delete the last Super Admin");
        }

        adminUserRepository.deleteById(Integer.parseInt(memberId));
        logAction(actorAdminId, "DELETE_MEMBER", "admin_user", memberId, null);
        return Map.of("success", true);
    }

    private long countActiveSuperAdmins() {
        return adminUserRepository.findAll().stream()
                .filter(a -> Boolean.TRUE.equals(a.getActive()))
                .filter(a -> a.getRole() == AdminRole.super_admin)
                .count();
    }

    private void assertActorMayAssign(AdminRole actor, AdminRole targetRole) {
        if (targetRole == AdminRole.super_admin && actor != AdminRole.super_admin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only Super Admin can assign the Super Admin role");
        }
    }

    private void assertActorMayModifyTarget(AdminRole actor, AdminRole targetRole) {
        if (actor == AdminRole.admin && targetRole == AdminRole.super_admin) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Insufficient permissions to modify this administrator");
        }
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
