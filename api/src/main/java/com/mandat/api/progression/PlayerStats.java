package com.mandat.api.progression;

/** Lifetime counters of {@code player_stats}; also used as an increment when updating them. */
public record PlayerStats(
        int packsOpened,
        int newCards,
        int rarePlusPulled,
        int quizzesCompleted,
        int perfectQuizzes,
        int duelsPlayed,
        int duelsWon,
        int cardsRecycled,
        int cardsCrafted) {

    public static final PlayerStats ZERO = new PlayerStats(0, 0, 0, 0, 0, 0, 0, 0, 0);
}
