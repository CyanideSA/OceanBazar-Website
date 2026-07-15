package com.oceanbazar.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import com.oceanbazar.backend.security.AdminAuthenticationFilter;
import com.oceanbazar.backend.security.AdminEndpointAccessFilter;
import com.oceanbazar.backend.security.JwtAuthenticationFilter;
import com.oceanbazar.backend.security.LoginRateLimitFilter;
import com.oceanbazar.backend.security.RequestIdCorrelationFilter;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.core.Ordered;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final AdminAuthenticationFilter adminAuthenticationFilter;
    private final AdminEndpointAccessFilter adminEndpointAccessFilter;
    private final LoginRateLimitFilter loginRateLimitFilter;

    public SecurityConfig(
            JwtAuthenticationFilter jwtAuthenticationFilter,
            AdminAuthenticationFilter adminAuthenticationFilter,
            AdminEndpointAccessFilter adminEndpointAccessFilter,
            LoginRateLimitFilter loginRateLimitFilter
    ) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.adminAuthenticationFilter = adminAuthenticationFilter;
        this.adminEndpointAccessFilter = adminEndpointAccessFilter;
        this.loginRateLimitFilter = loginRateLimitFilter;
    }

    @Bean
    @Order(Ordered.LOWEST_PRECEDENCE)
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .authorizeHttpRequests(auth -> auth
                        // Public endpoints
                        .requestMatchers(
                                "/api/auth/**",
                                "/api/products/**",
                                "/api/categories/**",
                                "/api/health",
                                "/api",
                                "/api/business-inquiry/**",
                                "/api/partner-requests/**",
                                "/api/wholesale/apply",
                                "/api/reviews/product/**",
                                "/api/coupons/validate",
                                "/api/site-settings",
                                "/uploads/**",
                                "/ws/**",
                                "/actuator/health",
                                "/actuator/info"
                        )
                        .permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/sellers/*").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/sellers/register").permitAll()
                        .requestMatchers("/api/admin/auth/login")
                        .permitAll()
                        .requestMatchers("/api/admin/**")
                        .hasAnyRole("SUPER_ADMIN", "ADMIN", "STAFF")
                        // Everything else requires a valid user JWT
                        .anyRequest()
                        .authenticated()
                );

        // Anchor custom filters to a known Spring Security filter to avoid
        // "does not have a registered order" startup failures.
        http.addFilterBefore(new RequestIdCorrelationFilter(), UsernamePasswordAuthenticationFilter.class);
        http.addFilterBefore(loginRateLimitFilter, UsernamePasswordAuthenticationFilter.class);
        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        http.addFilterBefore(adminAuthenticationFilter, JwtAuthenticationFilter.class);
        http.addFilterAfter(adminEndpointAccessFilter, AdminAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

}
