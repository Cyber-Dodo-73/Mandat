package com.mandat.api.quiz;

import java.time.Duration;

/** Quiz value tables. XP is granted by progression through {@code QuizCompletedEvent}. */
public final class QuizRules {

    public static final int QUESTIONS = 10;
    public static final int LIVES = 3;
    public static final Duration SESSION_TTL = Duration.ofMinutes(30);

    public static final int INFLUENCE_PER_CORRECT = 2;
    public static final int PERFECT_BONUS_INFLUENCE = 10;
    /** A bonus booster every N perfect quizzes. */
    public static final int PERFECT_QUIZZES_PER_BOOSTER = 5;

    private QuizRules() {}

    public static int influence(int correct, boolean perfect) {
        return correct * INFLUENCE_PER_CORRECT + (perfect ? PERFECT_BONUS_INFLUENCE : 0);
    }
}
