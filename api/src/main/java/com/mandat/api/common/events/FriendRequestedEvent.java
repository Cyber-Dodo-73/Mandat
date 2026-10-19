package com.mandat.api.common.events;

import java.time.Instant;
import java.util.UUID;

/** A player sent a friend request to another player. */
public record FriendRequestedEvent(UUID requesterId, UUID addresseeId, Instant at) {}
