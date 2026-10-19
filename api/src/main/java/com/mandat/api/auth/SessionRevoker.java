package com.mandat.api.auth;

import java.time.Clock;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ends every session of a player (password reset, ban). Access tokens already issued stay valid
 * until they expire (15 minutes); refresh tokens stop working immediately.
 */
@Service
public class SessionRevoker {

    private final RefreshTokenRepository tokens;
    private final Clock clock;

    SessionRevoker(RefreshTokenRepository tokens, Clock clock) {
        this.tokens = tokens;
        this.clock = clock;
    }

    @Transactional
    public void revokeAll(UUID userId) {
        tokens.revokeAllForUser(userId, clock.instant());
    }
}
