package com.mandat.api.auth.apple;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Sign in with Apple key (.p8) used to exchange authorization codes and revoke tokens when an
 * account is deleted (App Store Review Guideline 5.1.1(v)). All three values are required to
 * enable revocation; otherwise it is skipped (logged) and deletion still succeeds.
 *
 * @param teamId     Apple Developer team id (MANDAT_APPLE_TEAM_ID)
 * @param keyId      key id of the Sign in with Apple .p8 key (MANDAT_APPLE_KEY_ID)
 * @param privateKey PEM content of the .p8 key, literal "\n" accepted for newlines (MANDAT_APPLE_PRIVATE_KEY)
 */
@ConfigurationProperties(prefix = "mandat.auth.apple-signing")
public record AppleSigningProperties(String teamId, String keyId, String privateKey) {

    public boolean configured() {
        return notBlank(teamId) && notBlank(keyId) && notBlank(privateKey);
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    @Override
    public String toString() {
        return "AppleSigningProperties[teamId=" + teamId + ", keyId=" + keyId + ", configured=" + configured() + "]";
    }
}
