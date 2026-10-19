package com.mandat.api.auth;

import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Opaque refresh tokens with rotation and reuse detection. Every use revokes the presented token
 * and issues a new one in the same family; presenting a token that was already used revokes the
 * whole family, so a stolen token stops working for both the thief and the victim.
 * Clients must therefore serialize refreshes (one in flight at a time).
 */
@Service
class RefreshTokenService {

    private static final int TOKEN_BYTES = 32;

    private final RefreshTokenRepository tokens;
    private final AuthProperties properties;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    RefreshTokenService(RefreshTokenRepository tokens, AuthProperties properties, Clock clock) {
        this.tokens = tokens;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional
    IssuedRefreshToken issueNewFamily(UUID userId, String deviceLabel) {
        return issue(userId, UUID.randomUUID(), deviceLabel);
    }

    /** Family revocation on reuse must be committed even though the request fails. */
    @Transactional(noRollbackFor = ApiException.class)
    Rotation rotate(String rawToken) {
        RefreshToken current = tokens.findForUpdate(hash(rawToken)).orElseThrow(RefreshTokenService::invalid);
        Instant now = Instant.now(clock);
        if (current.isRevoked()) {
            tokens.revokeFamily(current.getFamilyId(), now);
            throw invalid();
        }
        current.revoke(now);
        if (!current.getExpiresAt().isAfter(now)) {
            throw invalid();
        }
        IssuedRefreshToken next = issue(current.getUserId(), current.getFamilyId(), current.getDeviceLabel());
        return new Rotation(current.getUserId(), next);
    }

    /** Revokes the family of the given token; unknown tokens are ignored (logout always succeeds). */
    @Transactional
    void revokeFamilyOf(String rawToken) {
        tokens.findByHash(hash(rawToken))
                .ifPresent(token -> tokens.revokeFamily(token.getFamilyId(), Instant.now(clock)));
    }

    private IssuedRefreshToken issue(UUID userId, UUID familyId, String deviceLabel) {
        byte[] bytes = new byte[TOKEN_BYTES];
        random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant now = Instant.now(clock);
        Instant expiresAt = now.plus(properties.refreshTokenTtl());
        tokens.save(new RefreshToken(userId, familyId, hash(raw), deviceLabel, now, expiresAt));
        return new IssuedRefreshToken(raw, expiresAt);
    }

    static byte[] hash(String rawToken) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(rawToken.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private static ApiException invalid() {
        return new ApiException(ErrorCode.INVALID_REFRESH_TOKEN, "Refresh token is invalid or expired");
    }

    record IssuedRefreshToken(String value, Instant expiresAt) {}

    record Rotation(UUID userId, IssuedRefreshToken refreshToken) {}
}
