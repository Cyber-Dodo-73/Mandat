package com.mandat.api.pack;

import java.time.Duration;
import java.time.Instant;

/**
 * Free booster timer, computed lazily from an anchor instant: one booster every {@link #INTERVAL},
 * at most {@link #MAX_STOCK} in stock. Time spent at full stock is not banked.
 */
public final class FreePackTimer {

    public static final Duration INTERVAL = Duration.ofHours(12);
    public static final int MAX_STOCK = 2;

    private FreePackTimer() {}

    /** Anchor for a new player: starts with a full stock. */
    public static Instant initialAnchor(Instant now) {
        return now.minus(INTERVAL.multipliedBy(MAX_STOCK));
    }

    public static int available(Instant anchor, Instant now) {
        if (!now.isAfter(anchor)) {
            return 0;
        }
        long accrued = Duration.between(anchor, now).dividedBy(INTERVAL);
        return (int) Math.min(MAX_STOCK, accrued);
    }

    /** When the next free booster is added to the stock, or null when the stock is full. */
    public static Instant nextAt(Instant anchor, Instant now) {
        int available = available(anchor, now);
        return available >= MAX_STOCK ? null : anchor.plus(INTERVAL.multipliedBy(available + 1L));
    }

    /** New anchor after consuming one free booster. Requires {@code available(anchor, now) > 0}. */
    public static Instant consume(Instant anchor, Instant now) {
        int available = available(anchor, now);
        if (available <= 0) {
            throw new IllegalStateException("No free booster available");
        }
        // At full stock the clock restarts from now, so the next booster comes one interval after.
        Instant effective = available >= MAX_STOCK ? now.minus(INTERVAL.multipliedBy(MAX_STOCK)) : anchor;
        return effective.plus(INTERVAL);
    }
}
