package com.mandat.api.common.events;

import java.time.Instant;
import java.util.UUID;

/** A friend streak reached a milestone; both players are told. */
public record FriendStreakMilestoneEvent(UUID streakId, UUID userA, UUID userB, int days, Instant at) {}
