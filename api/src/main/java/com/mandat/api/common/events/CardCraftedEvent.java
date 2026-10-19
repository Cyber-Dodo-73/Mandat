package com.mandat.api.common.events;

import java.time.Instant;
import java.util.UUID;

public record CardCraftedEvent(UUID userId, String cardId, int influenceSpent, Instant craftedAt) {}
