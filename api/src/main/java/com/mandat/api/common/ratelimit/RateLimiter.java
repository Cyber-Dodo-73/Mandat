package com.mandat.api.common.ratelimit;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import io.github.bucket4j.TimeMeter;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * In-memory token buckets keyed by policy + subject (IP, account, user id...).
 * Single-instance only: running several API instances needs a shared Bucket4j backend.
 */
@Component
public class RateLimiter {

    private final RateLimitProperties properties;
    private final TimeMeter timeMeter;
    private final Cache<String, Bucket> buckets = Caffeine.newBuilder()
            .maximumSize(100_000)
            .expireAfterAccess(Duration.ofHours(2))
            .build();

    @Autowired
    public RateLimiter(RateLimitProperties properties) {
        this(properties, TimeMeter.SYSTEM_MILLISECONDS);
    }

    RateLimiter(RateLimitProperties properties, TimeMeter timeMeter) {
        this.properties = properties;
        this.timeMeter = timeMeter;
    }

    /**
     * Consumes one token for {@code subject} under {@code policy}.
     *
     * @throws RateLimitExceededException when the bucket is empty
     * @throws IllegalArgumentException when the policy is not configured
     */
    public void consume(String policy, String subject) {
        RateLimitProperties.Limit limit = properties.policies().get(policy);
        if (limit == null) {
            throw new IllegalArgumentException("Unknown rate-limit policy: " + policy);
        }
        Bucket bucket = buckets.get(policy + ':' + subject, key -> newBucket(limit));
        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
        if (!probe.isConsumed()) {
            long seconds = Math.max(1, Duration.ofNanos(probe.getNanosToWaitForRefill()).toSeconds());
            throw new RateLimitExceededException(Duration.ofSeconds(seconds));
        }
    }

    private Bucket newBucket(RateLimitProperties.Limit limit) {
        return Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(limit.capacity())
                        .refillGreedy(limit.capacity(), limit.period())
                        .build())
                .withCustomTimePrecision(timeMeter)
                .build();
    }
}
