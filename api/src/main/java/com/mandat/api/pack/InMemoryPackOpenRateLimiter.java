package com.mandat.api.pack;

import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Per-player token bucket on booster openings, in memory (single API instance). Swap for a shared
 * limiter if the API is scaled out.
 */
@Component
public class InMemoryPackOpenRateLimiter implements PackOpenRateLimiter {

    static final int CAPACITY = 10;
    static final Duration REFILL_PERIOD = Duration.ofMinutes(1);

    private final Clock clock;
    private final Map<UUID, Bucket> buckets = new ConcurrentHashMap<>();

    public InMemoryPackOpenRateLimiter(Clock clock) {
        this.clock = clock;
    }

    @Override
    public void acquire(UUID userId) {
        long now = clock.millis();
        Bucket bucket = buckets.compute(userId, (id, current) ->
                (current == null ? new Bucket(CAPACITY, now) : current.refill(now)).take());
        if (bucket.denied()) {
            throw new ApiException(ErrorCode.RATE_LIMITED, "Too many boosters opened, try again in a moment");
        }
    }

    private record Bucket(double tokens, long updatedAt, boolean denied) {

        Bucket(double tokens, long updatedAt) {
            this(tokens, updatedAt, false);
        }

        Bucket refill(long now) {
            double perMilli = (double) CAPACITY / REFILL_PERIOD.toMillis();
            double refilled = Math.min(CAPACITY, tokens + Math.max(0, now - updatedAt) * perMilli);
            return new Bucket(refilled, now, false);
        }

        Bucket take() {
            return tokens >= 1 ? new Bucket(tokens - 1, updatedAt, false) : new Bucket(tokens, updatedAt, true);
        }
    }
}
