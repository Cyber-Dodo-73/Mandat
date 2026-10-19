package com.mandat.api.auth.social;

import com.mandat.api.auth.AuthProperties;
import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.user.SocialProvider;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.util.EnumMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

/**
 * Verifies Apple / Google ID tokens against the providers' public JWKS (fetched and cached by
 * Nimbus), with issuer, audience (configured client ids), expiry and optional nonce checks.
 */
@Component
public class JwksSocialTokenVerifier implements SocialTokenVerifier {

    private static final Duration CLOCK_SKEW = Duration.ofSeconds(60);
    private static final Map<SocialProvider, ProviderSpec> SPECS = Map.of(
            SocialProvider.APPLE, new ProviderSpec(
                    URI.create("https://appleid.apple.com/auth/keys"), Set.of("https://appleid.apple.com")),
            SocialProvider.GOOGLE, new ProviderSpec(
                    URI.create("https://www.googleapis.com/oauth2/v3/certs"),
                    Set.of("https://accounts.google.com", "accounts.google.com")));

    private final AuthProperties properties;
    private final Clock clock;
    private final Map<SocialProvider, JwtDecoder> decoders = new EnumMap<>(SocialProvider.class);

    public JwksSocialTokenVerifier(AuthProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
    }

    @Override
    public SocialIdentity verify(SocialProvider provider, String idToken, String nonce) {
        Jwt jwt;
        try {
            jwt = decoder(provider).decode(idToken);
        } catch (JwtException e) {
            throw rejected();
        }
        if (nonce != null && !nonceMatches(jwt.getClaimAsString("nonce"), nonce)) {
            throw rejected();
        }
        String subject = jwt.getSubject();
        if (subject == null || subject.isBlank()) {
            throw rejected();
        }
        return new SocialIdentity(subject, jwt.getClaimAsString("email"), isTrue(jwt.getClaims().get("email_verified")));
    }

    private synchronized JwtDecoder decoder(SocialProvider provider) {
        return decoders.computeIfAbsent(provider, this::buildDecoder);
    }

    private JwtDecoder buildDecoder(SocialProvider provider) {
        AuthProperties.Provider config = switch (provider) {
            case APPLE -> properties.apple();
            case GOOGLE -> properties.google();
        };
        List<String> audiences = config.clientIds();
        if (audiences.isEmpty()) {
            // Provider not configured: every token is rejected.
            return token -> {
                throw new JwtException("Provider disabled");
            };
        }
        ProviderSpec spec = SPECS.get(provider);
        URI jwksUri = config.jwksUri() != null ? config.jwksUri() : spec.jwksUri();
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(jwksUri.toString())
                .jwsAlgorithm(SignatureAlgorithm.RS256)
                .build();
        JwtTimestampValidator timestamps = new JwtTimestampValidator(CLOCK_SKEW);
        timestamps.setClock(clock);
        OAuth2TokenValidator<Jwt> issuer = jwt -> spec.issuers().contains(jwt.getClaimAsString("iss"))
                ? OAuth2TokenValidatorResult.success()
                : failure("Unexpected issuer");
        OAuth2TokenValidator<Jwt> audience = jwt -> jwt.getAudience() != null
                && jwt.getAudience().stream().anyMatch(audiences::contains)
                ? OAuth2TokenValidatorResult.success()
                : failure("Unexpected audience");
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(timestamps, issuer, audience));
        return decoder;
    }

    /** Apple apps usually send SHA-256(nonce) to Apple and keep the raw nonce: accept both forms. */
    static boolean nonceMatches(String claim, String rawNonce) {
        if (claim == null) {
            return false;
        }
        return MessageDigest.isEqual(claim.getBytes(StandardCharsets.UTF_8), rawNonce.getBytes(StandardCharsets.UTF_8))
                || MessageDigest.isEqual(claim.getBytes(StandardCharsets.UTF_8),
                        sha256Hex(rawNonce).getBytes(StandardCharsets.UTF_8));
    }

    private static String sha256Hex(String value) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    /** Apple sends {@code email_verified} as a string, Google as a boolean. */
    private static boolean isTrue(Object value) {
        return Boolean.TRUE.equals(value) || "true".equals(value);
    }

    private static OAuth2TokenValidatorResult failure(String description) {
        return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", description, null));
    }

    private static ApiException rejected() {
        return new ApiException(ErrorCode.INVALID_SOCIAL_TOKEN, "Sign-in token was rejected");
    }

    private record ProviderSpec(URI jwksUri, Set<String> issuers) {}
}
