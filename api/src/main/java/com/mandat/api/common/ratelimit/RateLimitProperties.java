package com.mandat.api.common.ratelimit;

import java.time.Duration;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Named rate-limit policies, e.g. {@code mandat.rate-limit.policies.auth-login-ip.capacity=10}. */
@ConfigurationProperties(prefix = "mandat.rate-limit")
public record RateLimitProperties(@DefaultValue Map<String, Limit> policies) {

    /** Allows {@code capacity} requests per {@code period}, refilled progressively. */
    public record Limit(int capacity, Duration period) {}
}
