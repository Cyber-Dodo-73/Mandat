package com.mandat.api.auth;

import com.mandat.api.auth.dto.AuthDtos.AuthResponse;
import com.mandat.api.auth.dto.AuthDtos.LoginRequest;
import com.mandat.api.auth.dto.AuthDtos.RegisterRequest;
import com.mandat.api.auth.dto.AuthDtos.SocialLoginRequest;
import com.mandat.api.auth.social.SocialIdentity;
import com.mandat.api.auth.social.SocialTokenVerifier;
import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.common.ratelimit.RateLimiter;
import com.mandat.api.user.SocialProvider;
import com.mandat.api.user.User;
import com.mandat.api.user.UserService;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class AuthService {

    static final String REGISTER_IP = "auth-register-ip";
    static final String LOGIN_IP = "auth-login-ip";
    static final String LOGIN_ACCOUNT = "auth-login-account";
    static final String REFRESH_IP = "auth-refresh-ip";
    static final String SOCIAL_IP = "auth-social-ip";

    private final UserService users;
    private final PasswordEncoder passwordEncoder;
    private final AccessTokenIssuer accessTokens;
    private final RefreshTokenService refreshTokens;
    private final SocialTokenVerifier socialVerifier;
    private final RateLimiter rateLimiter;
    /** Hash checked when the account does not exist, so response time does not reveal emails. */
    private final String dummyHash;

    AuthService(UserService users, PasswordEncoder passwordEncoder, AccessTokenIssuer accessTokens,
            RefreshTokenService refreshTokens, SocialTokenVerifier socialVerifier, RateLimiter rateLimiter) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.accessTokens = accessTokens;
        this.refreshTokens = refreshTokens;
        this.socialVerifier = socialVerifier;
        this.rateLimiter = rateLimiter;
        this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    @Transactional
    AuthResponse register(RegisterRequest request, String clientIp) {
        rateLimiter.consume(REGISTER_IP, clientIp);
        User user = users.createWithPassword(
                normalizeEmail(request.email()),
                passwordEncoder.encode(request.password()),
                request.nickname(),
                request.language(),
                request.timezone());
        return issueTokens(user.getId(), request.deviceLabel(), true);
    }

    @Transactional
    AuthResponse login(LoginRequest request, String clientIp) {
        String email = normalizeEmail(request.email());
        rateLimiter.consume(LOGIN_IP, clientIp);
        rateLimiter.consume(LOGIN_ACCOUNT, email);
        Optional<User> user = users.findByEmail(email).filter(found -> found.getPasswordHash() != null);
        String hash = user.map(User::getPasswordHash).orElse(dummyHash);
        boolean matches = passwordEncoder.matches(request.password(), hash);
        if (user.isEmpty() || !matches) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Email or password is incorrect");
        }
        return issueTokens(user.get().getId(), request.deviceLabel(), false);
    }

    AuthResponse refresh(String refreshToken, String clientIp) {
        rateLimiter.consume(REFRESH_IP, clientIp);
        RefreshTokenService.Rotation rotation = refreshTokens.rotate(refreshToken);
        AccessTokenIssuer.IssuedToken access = accessTokens.issue(rotation.userId());
        return response(rotation.userId(), access, rotation.refreshToken(), false);
    }

    void logout(String refreshToken) {
        refreshTokens.revokeFamilyOf(refreshToken);
    }

    /**
     * Signs in with a provider ID token. Known subject → that account. Otherwise a provider-verified
     * email matching an existing account links the provider to it; else a new account is created.
     */
    @Transactional
    AuthResponse social(SocialProvider provider, SocialLoginRequest request, String clientIp) {
        rateLimiter.consume(SOCIAL_IP, clientIp);
        SocialIdentity identity = socialVerifier.verify(provider, request.idToken(), request.nonce());
        Optional<User> known = users.findBySocialSubject(provider, identity.subject());
        if (known.isPresent()) {
            return issueTokens(known.get().getId(), request.deviceLabel(), false);
        }
        String email = identity.email() != null ? normalizeEmail(identity.email()) : null;
        if (email != null && identity.emailVerified()) {
            Optional<User> sameEmail = users.findByEmail(email);
            if (sameEmail.isPresent()) {
                User linked = users.linkSocial(sameEmail.get().getId(), provider, identity.subject());
                return issueTokens(linked.getId(), request.deviceLabel(), false);
            }
        }
        User created = users.createForSocial(provider, identity.subject(), identity.emailVerified() ? email : null,
                request.nickname(), request.language(), request.timezone());
        return issueTokens(created.getId(), request.deviceLabel(), true);
    }

    private AuthResponse issueTokens(UUID userId, String deviceLabel, boolean newUser) {
        AccessTokenIssuer.IssuedToken access = accessTokens.issue(userId);
        RefreshTokenService.IssuedRefreshToken refresh = refreshTokens.issueNewFamily(userId, deviceLabel);
        return response(userId, access, refresh, newUser);
    }

    private static AuthResponse response(UUID userId, AccessTokenIssuer.IssuedToken access,
            RefreshTokenService.IssuedRefreshToken refresh, boolean newUser) {
        return new AuthResponse("Bearer", access.value(), access.expiresAt(), refresh.value(), refresh.expiresAt(),
                userId, newUser);
    }

    private static String normalizeEmail(String email) {
        return email.strip().toLowerCase(Locale.ROOT);
    }
}
