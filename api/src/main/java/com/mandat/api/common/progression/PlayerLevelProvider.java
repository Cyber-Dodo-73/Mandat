package com.mandat.api.common.progression;

import java.util.UUID;

/** Player level, owned by the progression domain (used e.g. to unlock themed boosters). */
public interface PlayerLevelProvider {

    int levelOf(UUID userId);
}
