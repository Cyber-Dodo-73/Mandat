package com.mandat.api.common.events;

import java.time.Instant;
import java.util.UUID;

/** {@code accepterId} accepted the request {@code requesterId} had sent: they are now friends. */
public record FriendAcceptedEvent(UUID requesterId, UUID accepterId, Instant at) {}
