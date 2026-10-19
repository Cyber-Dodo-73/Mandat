package com.mandat.api.auth.apple;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import java.security.KeyFactory;
import java.security.interfaces.ECPrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Calls https://appleid.apple.com/auth/token and /auth/revoke with a client secret signed by the
 * Sign in with Apple key (ES256 JWT, 5 minutes). Disabled when the key is not configured.
 */
@Component
class HttpAppleAuthorizationClient implements AppleAuthorizationClient {

    private static final Logger log = LoggerFactory.getLogger(HttpAppleAuthorizationClient.class);
    private static final String APPLE = "https://appleid.apple.com";
    private static final Duration SECRET_TTL = Duration.ofMinutes(5);

    private final AppleSigningProperties properties;
    private final Clock clock;
    private final RestClient http;
    private final ECPrivateKey key;

    HttpAppleAuthorizationClient(AppleSigningProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
        this.http = RestClient.create(APPLE);
        this.key = properties.configured() ? parseKey(properties.privateKey()) : null;
        if (key == null) {
            log.info("Sign in with Apple key not configured: token revocation on account deletion is disabled");
        }
    }

    @Override
    public boolean enabled() {
        return key != null;
    }

    @Override
    public Optional<String> exchangeCode(String authorizationCode, String clientId) {
        if (!enabled()) {
            return Optional.empty();
        }
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret(clientId));
        form.add("code", authorizationCode);
        form.add("grant_type", "authorization_code");
        try {
            Map<?, ?> body = http.post().uri("/auth/token").contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form).retrieve().body(Map.class);
            Object token = body == null ? null : body.get("refresh_token");
            return token instanceof String refresh && !refresh.isBlank() ? Optional.of(refresh) : Optional.empty();
        } catch (RestClientException e) {
            log.warn("Apple authorization code exchange failed: {}", e.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    @Override
    public boolean revoke(String refreshToken, String clientId) {
        if (!enabled()) {
            return false;
        }
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret(clientId));
        form.add("token", refreshToken);
        form.add("token_type_hint", "refresh_token");
        try {
            http.post().uri("/auth/revoke").contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form).retrieve().toBodilessEntity();
            return true;
        } catch (RestClientException e) {
            log.warn("Apple token revocation failed: {}", e.getClass().getSimpleName());
            return false;
        }
    }

    private String clientSecret(String clientId) {
        Instant now = clock.instant();
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .issuer(properties.teamId())
                .subject(clientId)
                .audience(APPLE)
                .issueTime(Date.from(now))
                .expirationTime(Date.from(now.plus(SECRET_TTL)))
                .build();
        SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.ES256).keyID(properties.keyId()).build(), claims);
        try {
            jwt.sign(new ECDSASigner(key));
        } catch (JOSEException e) {
            throw new IllegalStateException("Could not sign the Apple client secret", e);
        }
        return jwt.serialize();
    }

    private static ECPrivateKey parseKey(String pem) {
        try {
            String base64 = pem.replace("\\n", "\n")
                    .replace("-----BEGIN PRIVATE KEY-----", "")
                    .replace("-----END PRIVATE KEY-----", "")
                    .replaceAll("\\s", "");
            byte[] der = Base64.getDecoder().decode(base64);
            return (ECPrivateKey) KeyFactory.getInstance("EC").generatePrivate(new PKCS8EncodedKeySpec(der));
        } catch (Exception e) {
            log.warn("MANDAT_APPLE_PRIVATE_KEY is not a valid PKCS#8 EC key: Apple revocation disabled");
            return null;
        }
    }
}
