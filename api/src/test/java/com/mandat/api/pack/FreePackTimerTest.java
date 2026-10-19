package com.mandat.api.pack;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class FreePackTimerTest {

    private static final Instant NOW = Instant.parse("2026-03-01T08:00:00Z");
    private static final Duration H12 = FreePackTimer.INTERVAL;

    @Test
    void newPlayerStartsWithAFullStock() {
        Instant anchor = FreePackTimer.initialAnchor(NOW);
        assertThat(FreePackTimer.available(anchor, NOW)).isEqualTo(2);
        assertThat(FreePackTimer.nextAt(anchor, NOW)).isNull();
    }

    @Test
    void consumingAtFullStockRestartsTheTimerFromNow() {
        Instant anchor = FreePackTimer.consume(FreePackTimer.initialAnchor(NOW), NOW);
        assertThat(FreePackTimer.available(anchor, NOW)).isEqualTo(1);
        assertThat(FreePackTimer.nextAt(anchor, NOW)).isEqualTo(NOW.plus(H12));

        anchor = FreePackTimer.consume(anchor, NOW);
        assertThat(FreePackTimer.available(anchor, NOW)).isZero();
        assertThat(FreePackTimer.nextAt(anchor, NOW)).isEqualTo(NOW.plus(H12));
    }

    @Test
    void progressTowardsTheNextBoosterIsKeptWhenConsumingBelowMaxStock() {
        Instant anchor = FreePackTimer.consume(FreePackTimer.initialAnchor(NOW), NOW);
        Instant later = NOW.plus(Duration.ofHours(5));
        anchor = FreePackTimer.consume(anchor, later);
        assertThat(FreePackTimer.available(anchor, later)).isZero();
        // The booster that was 5 h into its 12 h still arrives at NOW + 12 h.
        assertThat(FreePackTimer.nextAt(anchor, later)).isEqualTo(NOW.plus(H12));
        assertThat(FreePackTimer.available(anchor, NOW.plus(H12))).isEqualTo(1);
    }

    @Test
    void stockIsCappedAndTimeAtFullStockIsNotBanked() {
        Instant anchor = FreePackTimer.consume(FreePackTimer.initialAnchor(NOW), NOW);
        Instant muchLater = NOW.plus(Duration.ofDays(10));
        assertThat(FreePackTimer.available(anchor, muchLater)).isEqualTo(2);
        Instant afterConsume = FreePackTimer.consume(anchor, muchLater);
        assertThat(FreePackTimer.available(afterConsume, muchLater)).isEqualTo(1);
        assertThat(FreePackTimer.nextAt(afterConsume, muchLater)).isEqualTo(muchLater.plus(H12));
    }

    @Test
    void consumingWithoutStockFails() {
        Instant anchor = NOW.minus(Duration.ofHours(3));
        assertThatThrownBy(() -> FreePackTimer.consume(anchor, NOW)).isInstanceOf(IllegalStateException.class);
    }
}
