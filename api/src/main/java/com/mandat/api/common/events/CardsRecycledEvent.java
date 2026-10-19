package com.mandat.api.common.events;

import java.time.Instant;
import java.util.UUID;

public record CardsRecycledEvent(UUID userId, String cardId, int quantity, int influenceGained, Instant recycledAt) {}
