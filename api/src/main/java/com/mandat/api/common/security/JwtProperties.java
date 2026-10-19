package com.mandat.api.common.security;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Access-token signing settings. The secret comes from {@code MANDAT_JWT_SECRET} and must be at
 * least 32 bytes (HS256); startup fails otherwise. Only the {@code dev} profile ships a default.
 */
@ConfigurationProperties(prefix = "mandat.jwt")
public record JwtProperties(
        String secret,
        @DefaultValue("mandat-api") String issuer,
        @DefaultValue("PT15M") Duration accessTokenTtl) {

    static final int MIN_SECRET_BYTES = 32;

    public JwtProperties {
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "mandat.jwt.secret (MANDAT_JWT_SECRET) must be set to at least " + MIN_SECRET_BYTES + " bytes");
        }
    }

    @Override
    public String toString() {
        return "JwtProperties[issuer=" + issuer + ", accessTokenTtl=" + accessTokenTtl + "]";
    }
}
