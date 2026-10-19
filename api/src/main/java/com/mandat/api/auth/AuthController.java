package com.mandat.api.auth;

import com.mandat.api.auth.dto.AuthDtos.AuthResponse;
import com.mandat.api.auth.dto.AuthDtos.LoginRequest;
import com.mandat.api.auth.dto.AuthDtos.LogoutRequest;
import com.mandat.api.auth.dto.AuthDtos.RefreshRequest;
import com.mandat.api.auth.dto.AuthDtos.RegisterRequest;
import com.mandat.api.auth.dto.AuthDtos.SocialLoginRequest;
import com.mandat.api.user.SocialProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public endpoints. The client IP is {@code getRemoteAddr()}, which reflects X-Forwarded-For only
 * when the request comes through a trusted proxy ({@code server.forward-headers-strategy=native}).
 */
@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Auth", description = "Sign-up, sign-in and token lifecycle")
public class AuthController {

    private final AuthService authService;

    AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(operationId = "register", summary = "Create an account with email and password")
    public AuthResponse register(@Valid @RequestBody RegisterRequest request, HttpServletRequest http) {
        return authService.register(request, http.getRemoteAddr());
    }

    @PostMapping("/login")
    @Operation(operationId = "login", summary = "Sign in with email and password")
    public AuthResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        return authService.login(request, http.getRemoteAddr());
    }

    @PostMapping("/refresh")
    @Operation(operationId = "refreshTokens",
            summary = "Exchange a refresh token for new tokens (rotation; reusing a token revokes its family)")
    public AuthResponse refresh(@Valid @RequestBody RefreshRequest request, HttpServletRequest http) {
        return authService.refresh(request.refreshToken(), http.getRemoteAddr());
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(operationId = "logout", summary = "Revoke the refresh token family of this device")
    public void logout(@Valid @RequestBody LogoutRequest request) {
        authService.logout(request.refreshToken());
    }

    @PostMapping("/apple")
    @Operation(operationId = "signInWithApple", summary = "Sign in (or sign up) with an Apple ID token")
    public AuthResponse apple(@Valid @RequestBody SocialLoginRequest request, HttpServletRequest http) {
        return authService.social(SocialProvider.APPLE, request, http.getRemoteAddr());
    }

    @PostMapping("/google")
    @Operation(operationId = "signInWithGoogle", summary = "Sign in (or sign up) with a Google ID token")
    public AuthResponse google(@Valid @RequestBody SocialLoginRequest request, HttpServletRequest http) {
        return authService.social(SocialProvider.GOOGLE, request, http.getRemoteAddr());
    }
}
