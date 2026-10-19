package com.mandat.api.progression.achievement;

/** What an achievement measures. Metrics marked "param" use the definition's {@code param} key. */
public enum AchievementMetric {
    PACKS_OPENED,
    DISTINCT_CARDS,
    /** param: continent key. */
    CARDS_FROM_CONTINENT,
    /** param: era key. */
    CARDS_FROM_ERA,
    /** param: rarity key. */
    CARDS_OF_RARITY,
    /** param: finish key. */
    CARDS_WITH_FINISH,
    BEST_STREAK,
    LEVEL,
    QUIZZES_COMPLETED,
    PERFECT_QUIZZES,
    DUELS_WON,
    CARDS_RECYCLED,
    CARDS_CRAFTED
}
