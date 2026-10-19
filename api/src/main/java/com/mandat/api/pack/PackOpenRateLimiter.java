package com.mandat.api.pack;

import java.util.UUID;

/** Limits how fast a player can open boosters. */
public interface PackOpenRateLimiter {

    /** Throws {@code RATE_LIMITED} when the player opened too many boosters recently. */
    void acquire(UUID userId);
}
