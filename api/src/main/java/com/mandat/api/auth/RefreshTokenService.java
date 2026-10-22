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
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Opaque refresh tokens with rotation and reuse detection. Every use revokes the presented token
 * and issues a new one in the same family; presenting a token that was already used revokes the
 * whole family, so a stolen token stops working for both the thief and the victim.
 * Clients must therefore serialize refreshes (one in flight at a time).
 *
 * <p>Rotation grace: a mobile client regularly loses the rotation response (connection dropped
 * mid-request, app killed by the OS, keychain write refused while the phone is locked) and then
 * presents the previous token again. That is not theft as long as the successor was never used:
 * nobody else holds the chain. The used token is then accepted once more, the unused successor is
 * revoked and a fresh one issued. Each grace use is recorded and a family only gets
 * {@link #MAX_GRACE_USES} of them, so a token that leaked cannot be replayed forever.
 */
@Service
class RefreshTokenService {

    private static final int TOKEN_BYTES = 32;
    /** Grace uses allowed per family before a replay is treated as theft. */
    static final int MAX_GRACE_USES = 5;

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
        return issue(userId, UUID.randomUUID(), deviceLabel, null);
    }

    /** Family revocation on reuse must be committed even though the request fails. */
    @Transactional(noRollbackFor = ApiException.class)
    Rotation rotate(String rawToken) {
        RefreshToken current = tokens.findForUpdate(hash(rawToken)).orElseThrow(RefreshTokenService::invalid);
        Instant now = Instant.now(clock);
        if (current.isRevoked()) {
            if (!graceApplies(current, now)) {
                tokens.revokeFamily(current.getFamilyId(), now);
                throw invalid();
            }
            current.markReused(now);
        } else {
            current.revoke(now);
        }
        if (!current.getExpiresAt().isAfter(now)) {
            throw invalid();
        }
        IssuedRefreshToken next =
                issue(current.getUserId(), current.getFamilyId(), current.getDeviceLabel(), current.getId());
        return new Rotation(current.getUserId(), next);
    }

    /**
     * A used token is accepted again only when the token issued in exchange of it is still live,
     * meaning nobody ever presented it: the chain did not move on without this client. That lost
     * successor is revoked here (the client will never use it) and the family's grace budget is
     * charged. A successor that was used tells the chain continued elsewhere: theft.
     */
    private boolean graceApplies(RefreshToken current, Instant now) {
        List<RefreshToken> lostSuccessors = tokens.findLiveInFamilyForUpdate(current.getFamilyId()).stream()
                .filter(token -> current.getId().equals(token.getParentId()))
                .toList();
        if (lostSuccessors.isEmpty()
                || tokens.countByFamilyIdAndReusedAtIsNotNull(current.getFamilyId()) >= MAX_GRACE_USES) {
            return false;
        }
        lostSuccessors.forEach(token -> token.revoke(now));
        return true;
    }

    /** Revokes the family of the given token; unknown tokens are ignored (logout always succeeds). */
    @Transactional
    void revokeFamilyOf(String rawToken) {
        tokens.findByHash(hash(rawToken))
                .ifPresent(token -> tokens.revokeFamily(token.getFamilyId(), Instant.now(clock)));
    }

    private IssuedRefreshToken issue(UUID userId, UUID familyId, String deviceLabel, UUID parentId) {
        byte[] bytes = new byte[TOKEN_BYTES];
        random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant now = Instant.now(clock);
        Instant expiresAt = now.plus(properties.refreshTokenTtl());
        tokens.save(new RefreshToken(userId, familyId, hash(raw), deviceLabel, now, expiresAt, parentId));
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
