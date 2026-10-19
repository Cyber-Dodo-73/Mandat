package com.mandat.api.common.events;

import java.time.Instant;
import java.util.UUID;

/** A player invited a friend to start a friend streak. */
public record FriendStreakInvitedEvent(UUID inviterId, UUID inviteeId, Instant at) {}
