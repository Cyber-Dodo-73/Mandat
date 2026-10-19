package com.mandat.api.auth;

import java.net.URI;
import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Refresh-token lifetime and the identity providers accepted for social sign-in.
 * {@code clientIds} are the accepted ID-token audiences (iOS bundle id / Services ID for Apple,
 * OAuth client ids for Google). An empty list disables that provider.
 */
@ConfigurationProperties(prefix = "mandat.auth")
public record AuthProperties(
        @DefaultValue("P30D") Duration refreshTokenTtl,
        @DefaultValue Provider apple,
        @DefaultValue Provider google) {

    public record Provider(@DefaultValue List<String> clientIds, URI jwksUri) {}
}
