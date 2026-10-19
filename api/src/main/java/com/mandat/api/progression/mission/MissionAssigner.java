package com.mandat.api.progression.mission;

import com.mandat.api.progression.mission.MissionCatalog.Template;
import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.UUID;

/**
 * Picks the missions of a period deterministically from (user, period key): the same player
 * always gets the same missions for a given day or week, and players get different ones.
 */
public final class MissionAssigner {

    public static final int MISSIONS_PER_PERIOD = 3;

    private MissionAssigner() {}

    public static List<Template> assign(List<Template> pool, UUID userId, String periodKey) {
        List<Template> shuffled = new ArrayList<>(pool);
        // java.util.Random's algorithm is specified, so the shuffle is stable across JVMs.
        Collections.shuffle(shuffled, new Random(seed(userId, periodKey)));
        List<Template> picked = new ArrayList<>(MISSIONS_PER_PERIOD);
        Set<MissionType> types = EnumSet.noneOf(MissionType.class);
        for (Template template : shuffled) {
            if (types.add(template.type())) {
                picked.add(template);
                if (picked.size() == MISSIONS_PER_PERIOD) {
                    break;
                }
            }
        }
        return List.copyOf(picked);
    }

    static long seed(UUID userId, String periodKey) {
        long hash = userId.getMostSignificantBits() ^ Long.rotateLeft(userId.getLeastSignificantBits(), 17);
        for (int i = 0; i < periodKey.length(); i++) {
            hash = hash * 1_099_511_628_211L + periodKey.charAt(i);
        }
        return hash;
    }
}
