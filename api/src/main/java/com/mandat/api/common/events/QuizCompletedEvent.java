package com.mandat.api.common.events;

import java.time.Instant;
import java.util.UUID;

public record QuizCompletedEvent(UUID userId, UUID sessionId, int correctAnswers, int totalQuestions, Instant completedAt) {

    public boolean perfect() {
        return correctAnswers == totalQuestions;
    }
}
