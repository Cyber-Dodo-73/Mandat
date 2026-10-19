package com.mandat.api.duel;

import com.mandat.api.duel.engine.DuelAi.Difficulty;
import com.mandat.api.duel.engine.DuelEngine.Winner;

/** Duel value tables. XP is granted by progression through {@code DuelFinishedEvent}. */
public final class DuelRules {

    public static final int ROUNDS = 3;
    public static final int WINS_NEEDED = 2;

    private DuelRules() {}

    /** Influence granted at the end of a duel. */
    public static int influence(Difficulty difficulty, Winner winner) {
        return switch (winner) {
            case PLAYER -> switch (difficulty) {
                case EASY -> 10;
                case NORMAL -> 20;
                case HARD -> 35;
            };
            case DRAW -> 5;
            case AI -> 3;
        };
    }
}
