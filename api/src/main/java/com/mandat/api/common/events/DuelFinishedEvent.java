package com.mandat.api.common.events;

import java.time.Instant;
import java.util.UUID;

public record DuelFinishedEvent(UUID userId, UUID duelId, boolean won, String difficulty, Instant finishedAt) {}
