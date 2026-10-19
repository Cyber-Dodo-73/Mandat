package com.mandat.api.push;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.EnumMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Per-category opt-ins; a player without a row has the defaults (everything but marketing). */
@Repository
public class PushPreferencesRepository {

    private final JdbcClient jdbc;

    PushPreferencesRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public static Map<PushCategory, Boolean> defaults() {
        Map<PushCategory, Boolean> defaults = new EnumMap<>(PushCategory.class);
        for (PushCategory category : PushCategory.values()) {
            defaults.put(category, category != PushCategory.MARKETING);
        }
        return defaults;
    }

    public Map<PushCategory, Boolean> find(UUID userId) {
        return jdbc.sql("select booster_ready, streak, friends, events, marketing, nudges from push_preferences where user_id = :id")
                .param("id", userId)
                .query((rs, row) -> {
                    Map<PushCategory, Boolean> prefs = new EnumMap<>(PushCategory.class);
                    prefs.put(PushCategory.BOOSTER_READY, rs.getBoolean("booster_ready"));
                    prefs.put(PushCategory.STREAK, rs.getBoolean("streak"));
                    prefs.put(PushCategory.FRIENDS, rs.getBoolean("friends"));
                    prefs.put(PushCategory.EVENTS, rs.getBoolean("events"));
                    prefs.put(PushCategory.MARKETING, rs.getBoolean("marketing"));
                    prefs.put(PushCategory.NUDGES, rs.getBoolean("nudges"));
                    return prefs;
                })
                .optional()
                .orElseGet(PushPreferencesRepository::defaults);
    }

    public void save(UUID userId, Map<PushCategory, Boolean> prefs, Instant now) {
        jdbc.sql("""
                insert into push_preferences (user_id, booster_ready, streak, friends, events, marketing, nudges, updated_at)
                values (:id, :booster, :streak, :friends, :events, :marketing, :nudges, :now)
                on conflict (user_id) do update set
                    booster_ready = excluded.booster_ready, streak = excluded.streak, friends = excluded.friends,
                    events = excluded.events, marketing = excluded.marketing, nudges = excluded.nudges,
                    updated_at = excluded.updated_at
                """)
                .param("id", userId)
                .param("booster", prefs.get(PushCategory.BOOSTER_READY))
                .param("streak", prefs.get(PushCategory.STREAK))
                .param("friends", prefs.get(PushCategory.FRIENDS))
                .param("events", prefs.get(PushCategory.EVENTS))
                .param("marketing", prefs.get(PushCategory.MARKETING))
                .param("nudges", prefs.get(PushCategory.NUDGES))
                .param("now", Timestamp.from(now))
                .update();
    }
}
