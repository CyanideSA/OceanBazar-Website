package com.oceanbazar.backend.controller;

import com.oceanbazar.backend.dto.AuthDtos;
import com.oceanbazar.backend.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    /** POST /api/auth/signup — original endpoint (kept for backward compat) */
    @PostMapping("/signup")
    public AuthDtos.TokenResponse signup(@Valid @RequestBody AuthDtos.UserSignupRequest request) {
        return authService.signup(request);
    }

    /** POST /api/auth/register — storefront register page uses this */
    @PostMapping("/register")
    public AuthDtos.TokenResponse register(@Valid @RequestBody AuthDtos.UserRegisterRequest request) {
        return authService.register(request);
    }

    /** POST /api/auth/login */
    @PostMapping("/login")
    public AuthDtos.TokenResponse login(@Valid @RequestBody AuthDtos.UserLoginRequest request) {
        return authService.login(request);
    }

    /** POST /api/auth/send-otp */
    @PostMapping("/send-otp")
    public Map<String, Object> sendOtp(@Valid @RequestBody AuthDtos.OtpSendRequest request) {
        return authService.sendOtp(request);
    }

    /** POST /api/auth/verify-otp */
    @PostMapping("/verify-otp")
    public AuthDtos.TokenResponse verifyOtp(@Valid @RequestBody AuthDtos.OtpVerifyRequest request) {
        return authService.verifyOtp(request);
    }

    /** POST /api/auth/refresh — re-issue JWT from a still-valid token */
    @PostMapping("/refresh")
    public AuthDtos.TokenResponse refresh(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        return authService.refresh(authorization);
    }

    /** POST /api/auth/logout — stateless; client-side token drop */
    @PostMapping("/logout")
    public Map<String, Object> logout() {
        return authService.logout();
    }

    @GetMapping("/me")
    public AuthDtos.UserResponse me(@RequestHeader(value = "Authorization", required = false) String authorization) {
        return authService.me(authorization);
    }

    @PostMapping("/change-password")
    public Map<String, Object> changePassword(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @Valid @RequestBody AuthDtos.ChangePasswordRequest request
    ) {
        authService.changePassword(authorization, request.getCurrentPassword(), request.getNewPassword());
        return Map.of("success", true);
    }

    @PostMapping("/forgot-password")
    public Map<String, Object> forgotPassword(@RequestBody AuthDtos.ForgotPasswordRequest request) {
        return authService.forgotPassword(request.resolveTarget());
    }

    /** POST /api/auth/reset-password — verify OTP + set new password */
    @PostMapping("/reset-password")
    public Map<String, Object> resetPassword(@Valid @RequestBody AuthDtos.ResetPasswordRequest request) {
        return authService.resetPassword(request);
    }

    /** POST /api/auth/resend-verification — resend email verification OTP */
    @PostMapping("/resend-verification")
    public Map<String, Object> resendVerification(
            @RequestHeader(value = "Authorization", required = false) String authorization) {
        return authService.resendVerification(authorization);
    }

    /**
     * DEV ONLY: Reset any user's password without authentication.
     * Enabled only when app.dev-mode=true (set via env or properties).
     */
    @PostMapping("/dev-reset-password")
    public Map<String, Object> devResetPassword(@RequestBody Map<String, String> request) {
        String email = request.get("email");
        String newPassword = request.get("newPassword");
        if (email == null || newPassword == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "email and newPassword required");
        }
        authService.devResetPassword(email, newPassword);
        return Map.of("success", true, "message", "Password reset for " + email);
    }
}
