package com.mandat.api.auth.apple;

import java.util.Optional;

/** Apple's token endpoints (exchange of the authorization code, revocation). Replaced in tests. */
public interface AppleAuthorizationClient {

    /** False when the Sign in with Apple key is not configured: callers skip exchange and revocation. */
    boolean enabled();

    /** Exchanges a one-time authorization code for a refresh token; empty when Apple refuses it. */
    Optional<String> exchangeCode(String authorizationCode, String clientId);

    /** Revokes a refresh token. Returns false when Apple did not confirm the revocation. */
    boolean revoke(String refreshToken, String clientId);
}
