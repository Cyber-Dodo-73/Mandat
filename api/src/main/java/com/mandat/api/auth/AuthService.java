package com.mandat.api.auth;

import com.mandat.api.auth.dto.AuthDtos.AuthResponse;
import com.mandat.api.auth.dto.AuthDtos.LoginRequest;
import com.mandat.api.auth.dto.AuthDtos.RegisterRequest;
import com.mandat.api.auth.dto.AuthDtos.SocialLoginRequest;
import com.mandat.api.auth.apple.AppleAuthorizationClient;
import com.mandat.api.auth.social.SocialIdentity;
import com.mandat.api.auth.social.SocialTokenVerifier;
import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.common.ratelimit.RateLimiter;
import com.mandat.api.common.security.SecretCipher;
import com.mandat.api.legal.LegalProperties;
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
    private final LegalProperties legal;
    private final AppleAuthorizationClient apple;
    private final SecretCipher cipher;
    private final AuthProperties authProperties;
    /** Hash checked when the account does not exist, so response time does not reveal emails. */
    private final String dummyHash;

    AuthService(UserService users, PasswordEncoder passwordEncoder, AccessTokenIssuer accessTokens,
            RefreshTokenService refreshTokens, SocialTokenVerifier socialVerifier, RateLimiter rateLimiter,
            LegalProperties legal, AppleAuthorizationClient apple, SecretCipher cipher, AuthProperties authProperties) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.accessTokens = accessTokens;
        this.refreshTokens = refreshTokens;
        this.socialVerifier = socialVerifier;
        this.rateLimiter = rateLimiter;
        this.legal = legal;
        this.apple = apple;
        this.cipher = cipher;
        this.authProperties = authProperties;
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
                request.timezone(),
                legal.termsVersion());
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
        requireNotBanned(user.get());
        return issueTokens(user.get().getId(), request.deviceLabel(), false);
    }

    AuthResponse refresh(String refreshToken, String clientIp) {
        rateLimiter.consume(REFRESH_IP, clientIp);
        RefreshTokenService.Rotation rotation = refreshTokens.rotate(refreshToken);
        requireNotBanned(users.require(rotation.userId()));
        AccessTokenIssuer.IssuedToken access = accessTokens.issue(rotation.userId());
        return response(rotation.userId(), access, rotation.refreshToken(), false);
    }

    void logout(String refreshToken) {
        refreshTokens.revokeFamilyOf(refreshToken);
    }

    /**
     * Signs in with a provider ID token. A known subject signs into its account. Otherwise the
     * identity is linked to an existing account only when both sides vouch for the same email:
     * the provider marks it verified AND the existing account's email was itself verified (social
     * sign-up or password reset by email). Otherwise the sign-in gets a new, separate account.
     */
    @Transactional
    AuthResponse social(SocialProvider provider, SocialLoginRequest request, String clientIp) {
        rateLimiter.consume(SOCIAL_IP, clientIp);
        SocialIdentity identity = socialVerifier.verify(provider, request.idToken(), request.nonce());
        Optional<User> known = users.findBySocialSubject(provider, identity.subject());
        User user;
        boolean created = false;
        if (known.isPresent()) {
            user = known.get();
        } else {
            String email = identity.email() != null ? normalizeEmail(identity.email()) : null;
            Optional<User> linkable = email != null && identity.emailVerified()
                    ? users.findByEmail(email).filter(User::isEmailVerified)
                    : Optional.empty();
            if (linkable.isPresent()) {
                user = users.linkSocial(linkable.get().getId(), provider, identity.subject());
            } else {
                user = users.createForSocial(provider, identity.subject(), identity.emailVerified() ? email : null,
                        request.nickname(), request.language(), request.timezone());
                created = true;
            }
        }
        requireNotBanned(user);
        if (Boolean.TRUE.equals(request.acceptTerms())) {
            users.acceptTerms(user.getId(), legal.termsVersion());
        }
        if (provider == SocialProvider.APPLE && request.authorizationCode() != null && apple.enabled()) {
            storeAppleRefreshToken(user.getId(), request.authorizationCode(), identity.audience());
        }
        return issueTokens(user.getId(), request.deviceLabel(), created);
    }

    /** Keeps an Apple refresh token so the authorization can be revoked when the account is deleted. */
    private void storeAppleRefreshToken(UUID userId, String authorizationCode, String audience) {
        String clientId = audience != null ? audience
                : authProperties.apple().clientIds().isEmpty() ? null : authProperties.apple().clientIds().get(0);
        if (clientId == null) {
            return;
        }
        apple.exchangeCode(authorizationCode, clientId)
                .ifPresent(token -> users.setAppleRefreshToken(userId, cipher.encrypt(clientId + "\n" + token)));
    }

    private static void requireNotBanned(User user) {
        if (user.isBanned()) {
            throw new ApiException(ErrorCode.ACCOUNT_BANNED, "This account is suspended");
        }
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
