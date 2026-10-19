package com.mandat.api.user;

import java.util.UUID;

/**
 * Lets other domains add a section to {@code GET /me} without coupling the user domain to them,
 * e.g. progression contributes {@code "progression"} (level, XP, streak) and packs contribute
 * {@code "packs"} (free-pack timers). Each contribution must be a DTO record, cheap to compute,
 * and must not modify state.
 */
public interface MeContributor {

    /** Key of the section in {@code MeResponse.sections}; unique across contributors. */
    String key();

    Object contribute(UUID userId);
}
