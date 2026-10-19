package com.mandat.api.auth.social;

import com.mandat.api.user.SocialProvider;

/** Verifies an Apple or Google ID token server-side (signature, issuer, audience, expiry, nonce). */
public interface SocialTokenVerifier {

    /**
     * @param nonce the raw nonce the client generated for this sign-in, or null if none was used
     * @throws com.mandat.api.common.error.ApiException INVALID_SOCIAL_TOKEN when the token is rejected
     */
    SocialIdentity verify(SocialProvider provider, String idToken, String nonce);
}
