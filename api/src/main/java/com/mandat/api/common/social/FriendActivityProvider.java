package com.mandat.api.common.social;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;

/**
 * Today's streak activity of a player's friends, for the friends list ("inactif aujourd'hui" and
 * the nudge button). Implemented by the streak domain; the default knows nothing.
 */
public interface FriendActivityProvider {

    /**
     * @param activeToday the friend kept their streak today (their own local day)
     * @param nudgedToday the viewer already nudged this friend today (viewer's local day)
     */
    record FriendActivity(boolean activeToday, boolean nudgedToday) {}

    Map<UUID, FriendActivity> activity(UUID viewerId, Collection<UUID> friendIds);

    FriendActivityProvider NONE = (viewer, friends) -> Map.of();
}
