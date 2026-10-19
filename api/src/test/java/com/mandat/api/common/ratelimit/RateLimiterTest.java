package com.mandat.api.common.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.github.bucket4j.TimeMeter;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;

class RateLimiterTest {

    private final AtomicLong nanos = new AtomicLong();
    private final TimeMeter clock = new TimeMeter() {
        @Override
        public long currentTimeNanos() {
            return nanos.get();
        }

        @Override
        public boolean isWallClockBased() {
            return false;
        }
    };
    private final RateLimiter limiter = new RateLimiter(
            new RateLimitProperties(Map.of("test", new RateLimitProperties.Limit(2, Duration.ofMinutes(1)))), clock);

    @Test
    void blocksAfterCapacityThenRefills() {
        limiter.consume("test", "a");
        limiter.consume("test", "a");
        assertThatThrownBy(() -> limiter.consume("test", "a"))
                .isInstanceOfSatisfying(RateLimitExceededException.class,
                        e -> assertThat(e.retryAfter()).isEqualTo(Duration.ofSeconds(30)));

        nanos.addAndGet(Duration.ofSeconds(30).toNanos());
        limiter.consume("test", "a");
    }

    @Test
    void subjectsHaveSeparateBuckets() {
        limiter.consume("test", "a");
        limiter.consume("test", "a");
        limiter.consume("test", "b");
    }

    @Test
    void unknownPolicyIsAProgrammingError() {
        assertThatThrownBy(() -> limiter.consume("missing", "a")).isInstanceOf(IllegalArgumentException.class);
    }
}
