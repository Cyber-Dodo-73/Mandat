package com.mandat.api.pack;

import java.util.UUID;

/**
 * Player level, used to unlock themed boosters. Implemented by the progression domain; until a bean
 * exists every player is level 1.
 */
public interface PlayerLevelProvider {

    int level(UUID userId);
}
