package com.mandat.api.common.events;

import java.time.Instant;
import java.util.UUID;

/** "X te relance !": a player nudged a friend who hasn't kept their streak today. */
public record FriendNudgedEvent(UUID senderId, UUID receiverId, Instant at) {}
