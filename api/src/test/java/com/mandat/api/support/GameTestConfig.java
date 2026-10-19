package com.mandat.api.support;

import com.mandat.api.TestcontainersConfig;
import com.mandat.api.common.events.PackOpenedEvent;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.context.event.EventListener;

/** Shared context for the game integration tests: Postgres, a controllable clock, a failure switch. */
@TestConfiguration(proxyBeanMethods = false)
@Import(TestcontainersConfig.class)
public class GameTestConfig {

    public static final Instant START = Instant.parse("2026-03-01T08:00:00Z");

    @Bean
    @Primary
    MutableClock mutableClock() {
        return new MutableClock(START);
    }

    @Bean
    FailingPackListener failingPackListener() {
        return new FailingPackListener();
    }

    public static final class MutableClock extends Clock {

        private final AtomicReference<Instant> now;

        MutableClock(Instant start) {
            this.now = new AtomicReference<>(start);
        }

        public void set(Instant instant) {
            now.set(instant);
        }

        public void advance(java.time.Duration duration) {
            now.updateAndGet(current -> current.plus(duration));
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now.get();
        }
    }

    /** Throws inside the opening transaction when enabled, to prove the opening is atomic. */
    public static final class FailingPackListener {

        public final AtomicBoolean enabled = new AtomicBoolean();

        @EventListener
        void onPackOpened(PackOpenedEvent event) {
            if (enabled.get()) {
                throw new IllegalStateException("Simulated failure after the draw");
            }
        }
    }
}
