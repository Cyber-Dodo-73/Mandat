package com.mandat.api.common.events;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Published inside the pack-opening transaction, after the cards are added to the collection. */
public record PackOpenedEvent(UUID userId, String packId, List<String> cardIds, List<String> newCardIds, Instant openedAt) {}
