package com.mandat.api.push;

import com.fasterxml.jackson.annotation.JsonValue;

/**
 * Notification categories the player can turn on or off. Transactional ones answer something
 * that happened to the player (a booster is ready, a friend request); the others are reminders
 * and are capped harder.
 */
public enum PushCategory {
    BOOSTER_READY("booster_ready", true),
    STREAK("streak", true),
    FRIENDS("friends", true),
    EVENTS("events", false),
    MARKETING("marketing", false);

    private final String key;
    private final boolean transactional;

    PushCategory(String key, boolean transactional) {
        this.key = key;
        this.transactional = transactional;
    }

    @JsonValue
    public String key() {
        return key;
    }

    public boolean transactional() {
        return transactional;
    }
}
