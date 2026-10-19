package com.mandat.api.auth.social;

/**
 * Identity extracted from a verified provider ID token. {@code email} is null when not shared;
 * {@code audience} is the client id the token was issued for (null when unknown).
 */
public record SocialIdentity(String subject, String email, boolean emailVerified, String audience) {

    public SocialIdentity(String subject, String email, boolean emailVerified) {
        this(subject, email, emailVerified, null);
    }
}
