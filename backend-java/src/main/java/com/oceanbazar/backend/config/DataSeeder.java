package com.oceanbazar.backend.config;

import com.oceanbazar.backend.entity.AdminUserEntity;
import com.oceanbazar.backend.entity.SupportAgentEntity;
import com.oceanbazar.backend.entity.enums.AdminRole;
import com.oceanbazar.backend.repository.AdminUserRepository;
import com.oceanbazar.backend.repository.SupportAgentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class DataSeeder {
    private final AdminUserRepository adminUserRepository;
    private final SupportAgentRepository supportAgentRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.seed:true}")
    private boolean seedEnabled;

    @Bean
    CommandLineRunner seedData() {
        return args -> {
            ensurePrimaryAdminLogin();

            if (!seedEnabled) {
                log.info("Seed skipped (app.seed=false).");
                return;
            }

            seedDefaultAdminAndAgents();
        };
    }

    private void ensurePrimaryAdminLogin() {
        AdminUserEntity admin = adminUserRepository.findByUsername("rjsuvosa").orElse(null);
        if (admin == null) {
            admin = new AdminUserEntity();
            admin.setName("Suvo Ahmed");
            admin.setUsername("rjsuvosa");
            admin.setEmail("rjsuvo.00000@gmail.com");
            admin.setPasswordHash(passwordEncoder.encode("rjsuvosa420"));
            admin.setRole(AdminRole.super_admin);
            admin.setActive(true);
            adminUserRepository.save(admin);
            log.warn("Primary admin created/reset: {}", admin.getUsername());
            return;
        }

        boolean changed = false;
        if (!Boolean.TRUE.equals(admin.getActive())) {
            admin.setActive(true);
            changed = true;
        }
        if (admin.getEmail() == null || admin.getEmail().isBlank()) {
            admin.setEmail("rjsuvo.00000@gmail.com");
            changed = true;
        }
        if (!passwordEncoder.matches("rjsuvosa420", admin.getPasswordHash())) {
            admin.setPasswordHash(passwordEncoder.encode("rjsuvosa420"));
            changed = true;
        }
        if (changed) {
            adminUserRepository.save(admin);
            log.warn("Primary admin credentials refreshed: {}", admin.getUsername());
        }
    }

    private void seedDefaultAdminAndAgents() {
        if (!adminUserRepository.existsByUsername("rjsuvosa")) {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setName("Suvo Ahmed");
            admin.setUsername("rjsuvosa");
            admin.setEmail("rjsuvo.00000@gmail.com");
            admin.setPasswordHash(passwordEncoder.encode("rjsuvosa420"));
            admin.setRole(AdminRole.admin);
            admin.setActive(true);
            adminUserRepository.save(admin);
            log.info("Primary admin seeded: {}", admin.getUsername());
        }

        ensureSuperAdminAccount();

        if (!adminUserRepository.existsByUsername("editor01")) {
            AdminUserEntity editor = new AdminUserEntity();
            editor.setName("OceanBazar Editor");
            editor.setUsername("editor01");
            editor.setEmail("editor@oceanbazar.com.bd");
            editor.setPasswordHash(passwordEncoder.encode("editor123"));
            editor.setRole(AdminRole.admin);
            editor.setActive(true);
            adminUserRepository.save(editor);
        }

        if (!adminUserRepository.existsByUsername("moderator01")) {
            AdminUserEntity moderator = new AdminUserEntity();
            moderator.setName("OceanBazar Moderator");
            moderator.setUsername("moderator01");
            moderator.setEmail("moderator@oceanbazar.com.bd");
            moderator.setPasswordHash(passwordEncoder.encode("moderator123"));
            moderator.setRole(AdminRole.staff);
            moderator.setActive(true);
            adminUserRepository.save(moderator);
        }

        if (supportAgentRepository.findByAgentId("AG001").isEmpty()) {
            SupportAgentEntity agent = new SupportAgentEntity();
            agent.setAgentId("AG001");
            agent.setName("OceanBazar Support");
            agent.setEmail("support@oceanbazar.com.bd");
            agent.setRole("SUPPORT_AGENT");
            agent.setActive(true);
            supportAgentRepository.save(agent);
            log.info("Default support agent seeded: {}", agent.getAgentId());
        }
    }

    private void ensureSuperAdminAccount() {
        long superCount = adminUserRepository.findAll().stream()
                .filter(a -> AdminRole.fromAny(a.getRole()) == AdminRole.super_admin)
                .count();
        if (superCount > 0) {
            return;
        }
        adminUserRepository.findByUsername("rjsuvosa").ifPresentOrElse(a -> {
            a.setRole(AdminRole.super_admin);
            adminUserRepository.save(a);
            log.warn("Migrated {} to super_admin (no Super Admin was present)", a.getUsername());
        }, () -> adminUserRepository.findAll().stream().findFirst().ifPresent(a -> {
            a.setRole(AdminRole.super_admin);
            adminUserRepository.save(a);
            log.warn("Migrated user {} to super_admin — review admin_users table", a.getUsername());
        }));
    }
}
