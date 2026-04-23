package com.oceanbazar.backend.service;

import com.oceanbazar.backend.dto.AuthDtos;
import com.oceanbazar.backend.entity.OtpCodeEntity;
import com.oceanbazar.backend.entity.UserEntity;
import com.oceanbazar.backend.entity.enums.AccountStatus;
import com.oceanbazar.backend.entity.enums.OtpType;
import com.oceanbazar.backend.entity.enums.UserType;
import com.oceanbazar.backend.repository.OtpCodeRepository;
import com.oceanbazar.backend.repository.UserRepository;
import com.oceanbazar.backend.security.JwtService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {
    private final UserRepository userRepository;
    private final OtpCodeRepository otpCodeRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int OTP_EXPIRY_MINUTES = 10;
    private static final Pattern PASSWORD_UPPER = Pattern.compile("[A-Z]");
    private static final Pattern PASSWORD_LOWER = Pattern.compile("[a-z]");
    private static final Pattern PASSWORD_DIGIT = Pattern.compile("\\d");
    private static final Pattern PASSWORD_SYMBOL = Pattern.compile("[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?]");

    // ─── Password validation ─────────────────────────────────────────────────────

    private void validatePasswordStrength(String password) {
        if (password == null || password.length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 8 characters");
        }
        if (!PASSWORD_UPPER.matcher(password).find()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must contain at least one uppercase letter");
        }
        if (!PASSWORD_LOWER.matcher(password).find()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must contain at least one lowercase letter");
        }
        if (!PASSWORD_DIGIT.matcher(password).find()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must contain at least one number");
        }
        if (!PASSWORD_SYMBOL.matcher(password).find()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must contain at least one symbol");
        }
    }

    // ─── OTP generation ──────────────────────────────────────────────────────────

    private String generateHexOtp() {
        int value = SECURE_RANDOM.nextInt(0xFFFFFF + 1);
        return String.format("%06X", value);
    }

    @Transactional
    private OtpCodeEntity createAndSaveOtp(String target, OtpType type) {
        otpCodeRepository.markAllUsed(target, type);
        String code = generateHexOtp();
        OtpCodeEntity otp = OtpCodeEntity.builder()
                .target(target)
                .code(code)
                .type(type)
                .expiresAt(Instant.now().plus(OTP_EXPIRY_MINUTES, ChronoUnit.MINUTES))
                .used(false)
                .build();
        otp = otpCodeRepository.save(otp);
        log.info("╔══════════════════════════════════════╗");
        log.info("║  OTP for {}: {}  ║", target, code);
        log.info("║  Type: {}, Expires: {} min    ║", type, OTP_EXPIRY_MINUTES);
        log.info("╚══════════════════════════════════════╝");
        return otp;
    }

    private OtpCodeEntity verifyOtpCode(String target, String code, OtpType type) {
        OtpCodeEntity otp = otpCodeRepository
                .findFirstByTargetAndTypeAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(target, type, Instant.now())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "OTP expired or not found. Please request a new one."));
        if (!otp.getCode().equalsIgnoreCase(code.trim())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid OTP code");
        }
        otp.setUsed(true);
        otpCodeRepository.save(otp);
        return otp;
    }

    // ─── Signup / Register ───────────────────────────────────────────────────────

    @Transactional
    public AuthDtos.TokenResponse signup(AuthDtos.UserSignupRequest request) {
        validatePasswordStrength(request.getPassword());
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already registered");
        }

        UserEntity user = new UserEntity();
        user.setName(request.getName());
        user.setEmail(request.getEmail());
        user.setPhone(request.getPhone());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setUserType(UserType.retail);
        user.setEmailVerified(false);
        user.setAccountStatus(AccountStatus.pending_verification);
        user = userRepository.save(user);

        // Send email verification OTP
        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            createAndSaveOtp(user.getEmail(), OtpType.verify_email);
        }

        String token = jwtService.createToken(user.getId(), user.getEmail());
        return toTokenResponse(user, token);
    }

    @Transactional
    public AuthDtos.TokenResponse register(AuthDtos.UserRegisterRequest request) {
        validatePasswordStrength(request.getPassword());
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email already registered");
        }
        if (request.getPhone() != null && !request.getPhone().isBlank() && userRepository.existsByPhone(request.getPhone())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phone number already registered");
        }

        UserEntity user = new UserEntity();
        user.setName(request.getName());
        user.setEmail(request.getEmail());
        user.setPhone(request.getPhone());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setUserType(UserType.retail);
        user.setEmailVerified(false);
        user.setAccountStatus(AccountStatus.pending_verification);
        user = userRepository.save(user);

        // Send email verification OTP
        if (user.getEmail() != null && !user.getEmail().isBlank()) {
            createAndSaveOtp(user.getEmail(), OtpType.verify_email);
        }

        String token = jwtService.createToken(user.getId(), user.getEmail());
        return toTokenResponse(user, token);
    }

    // ─── Login ───────────────────────────────────────────────────────────────────

    public AuthDtos.TokenResponse login(AuthDtos.UserLoginRequest request) {
        String identifier = request.resolveIdentifier();
        if (identifier == null || identifier.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email or phone is required");
        }

        UserEntity user = identifier.contains("@")
                ? userRepository.findByEmail(identifier)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"))
                : userRepository.findByPhone(identifier)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid phone or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        checkAccountAccess(user);

        String token = jwtService.createToken(user.getId(), user.getEmail());
        return toTokenResponse(user, token);
    }

    // ─── OTP: send / verify ──────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> sendOtp(AuthDtos.OtpSendRequest request) {
        String target = request.getTarget() != null ? request.getTarget().trim() : "";
        String typeStr = request.getType() != null ? request.getType().trim() : "login";

        OtpType otpType;
        switch (typeStr) {
            case "verify_email": otpType = OtpType.verify_email; break;
            case "forgot_password": otpType = OtpType.forgot_password; break;
            default: otpType = OtpType.login; break;
        }

        // For login & forgot_password, user must exist
        if (otpType == OtpType.login || otpType == OtpType.forgot_password) {
            Optional<UserEntity> found = target.contains("@")
                    ? userRepository.findByEmail(target)
                    : userRepository.findByPhone(target);
            if (found.isEmpty()) {
                // Silent success to prevent user enumeration
                return Map.of("success", true, "message", "If an account exists, an OTP has been sent.");
            }
        }

        createAndSaveOtp(target, otpType);
        return Map.of("success", true, "message", "OTP sent successfully");
    }

    @Transactional
    public AuthDtos.TokenResponse verifyOtp(AuthDtos.OtpVerifyRequest request) {
        String target = request.getTarget() != null ? request.getTarget().trim() : "";
        String code = request.getCode() != null ? request.getCode().trim() : "";

        // Try verify_email first, then login
        Optional<OtpCodeEntity> emailOtp = otpCodeRepository
                .findFirstByTargetAndTypeAndUsedFalseAndExpiresAtAfterOrderByCreatedAtDesc(target, OtpType.verify_email, Instant.now());

        if (emailOtp.isPresent() && emailOtp.get().getCode().equalsIgnoreCase(code)) {
            // This is an email verification
            emailOtp.get().setUsed(true);
            otpCodeRepository.save(emailOtp.get());

            UserEntity user = target.contains("@")
                    ? userRepository.findByEmail(target)
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"))
                    : userRepository.findByPhone(target)
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

            user.setEmailVerified(true);
            if (user.getAccountStatus() == AccountStatus.pending_verification) {
                user.setAccountStatus(AccountStatus.active);
            }
            userRepository.save(user);
            log.info("Email verified for user: {}", user.getId());

            String token = jwtService.createToken(user.getId(), user.getEmail());
            return toTokenResponse(user, token);
        }

        // Otherwise treat as login OTP
        verifyOtpCode(target, code, OtpType.login);

        UserEntity user = target.contains("@")
                ? userRepository.findByEmail(target)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"))
                : userRepository.findByPhone(target)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        checkAccountAccess(user);

        String token = jwtService.createToken(user.getId(), user.getEmail());
        return toTokenResponse(user, token);
    }

    // ─── Token refresh / logout ──────────────────────────────────────────────────

    public AuthDtos.TokenResponse refresh(String authHeader) {
        String token = extractBearer(authHeader);
        Claims claims;
        try {
            claims = jwtService.parse(token);
        } catch (JwtException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired token");
        }
        String userId = claims.get("user_id", String.class);
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        checkAccountAccess(user);
        String newToken = jwtService.createToken(user.getId(), user.getEmail());
        return toTokenResponse(user, newToken);
    }

    public Map<String, Object> logout() {
        return Map.of("success", true);
    }

    // ─── Me ──────────────────────────────────────────────────────────────────────

    public AuthDtos.UserResponse me(String authHeader) {
        String token = extractBearer(authHeader);
        Claims claims;
        try {
            claims = jwtService.parse(token);
        } catch (JwtException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid authentication credentials");
        }
        String userId = claims.get("user_id", String.class);
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        return toUserResponse(user);
    }

    // ─── Change password ─────────────────────────────────────────────────────────

    public void changePassword(String authHeader, String currentPassword, String newPassword) {
        validatePasswordStrength(newPassword);
        String token = extractBearer(authHeader);
        Claims claims;
        try {
            claims = jwtService.parse(token);
        } catch (JwtException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid authentication credentials");
        }
        String userId = claims.get("user_id", String.class);
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        checkAccountAccess(user);
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is incorrect");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
    }

    // ─── Forgot password flow ────────────────────────────────────────────────────

    @Transactional
    public Map<String, Object> forgotPassword(String target) {
        if (target == null || target.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Email or phone is required");
        }
        target = target.trim();
        Optional<UserEntity> found = target.contains("@")
                ? userRepository.findByEmail(target)
                : userRepository.findByPhone(target);

        if (found.isPresent()) {
            createAndSaveOtp(target, OtpType.forgot_password);
        }
        // Always return success to prevent user enumeration
        return Map.of("success", true, "message", "If an account exists, a reset OTP has been sent.");
    }

    @Transactional
    public Map<String, Object> resetPassword(AuthDtos.ResetPasswordRequest request) {
        String target = request.getTarget().trim();
        validatePasswordStrength(request.getNewPassword());

        verifyOtpCode(target, request.getOtp(), OtpType.forgot_password);

        UserEntity user = target.contains("@")
                ? userRepository.findByEmail(target)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"))
                : userRepository.findByPhone(target)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        log.info("Password reset for user: {}", user.getId());
        return Map.of("success", true, "message", "Password has been reset. Please log in with your new password.");
    }

    // ─── Resend email verification ───────────────────────────────────────────────

    @Transactional
    public Map<String, Object> resendVerification(String authHeader) {
        String token = extractBearer(authHeader);
        Claims claims;
        try {
            claims = jwtService.parse(token);
        } catch (JwtException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid token");
        }
        String userId = claims.get("user_id", String.class);
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (Boolean.TRUE.equals(user.getEmailVerified())) {
            return Map.of("success", true, "message", "Email is already verified");
        }
        if (user.getEmail() == null || user.getEmail().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No email on file");
        }
        createAndSaveOtp(user.getEmail(), OtpType.verify_email);
        return Map.of("success", true, "message", "Verification OTP resent");
    }

    /** DEV ONLY: Reset any user's password without knowing the old one. */
    public void devResetPassword(String email, String newPassword) {
        String hashed = passwordEncoder.encode(newPassword);
        int updated = userRepository.updatePasswordByEmailNative(email.trim(), hashed);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + email);
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────────

    private void checkAccountAccess(UserEntity user) {
        AccountStatus status = user.getAccountStatus();
        if (status == AccountStatus.suspended) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This account has been suspended");
        }
        // pending_verification is allowed to login — frontend shows verification prompt
    }

    private String extractBearer(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid authentication credentials");
        }
        return authHeader.substring(7);
    }

    private AuthDtos.TokenResponse toTokenResponse(UserEntity user, String token) {
        AuthDtos.TokenResponse response = new AuthDtos.TokenResponse();
        response.setUser(toUserResponse(user));
        response.setToken(token);
        return response;
    }

    private AuthDtos.UserResponse toUserResponse(UserEntity user) {
        AuthDtos.UserResponse response = new AuthDtos.UserResponse();
        response.setId(user.getId());
        response.setName(user.getName());
        response.setEmail(user.getEmail());
        response.setRole(user.getUserType() != null ? user.getUserType().name() : "retail");
        response.setUserType(user.getUserType() != null ? user.getUserType().name() : "retail");
        response.setProfileImageUrl(user.getProfileImage());
        response.setEmailVerified(Boolean.TRUE.equals(user.getEmailVerified()));
        return response;
    }
}
