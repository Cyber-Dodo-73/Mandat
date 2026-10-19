package com.mandat.api.progression.mission;

/** What a mission counts. Missions of one assignment always have distinct types. */
public enum MissionType {
    OPEN_PACKS,
    PULL_RARE_OR_BETTER,
    NEW_CARDS,
    /** New cards from the continent in the mission's {@code param}. */
    NEW_CARDS_FROM_CONTINENT,
    COMPLETE_QUIZ,
    PERFECT_QUIZ,
    PLAY_DUEL,
    WIN_DUEL,
    RECYCLE_CARDS,
    CRAFT_CARD
}
