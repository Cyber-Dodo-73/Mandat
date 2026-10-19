package com.mandat.api.progression.achievement;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class AchievementRepository {

    private final JdbcClient jdbc;

    public AchievementRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Achievement id → unlock time. */
    public Map<String, Instant> unlocked(UUID userId) {
        return jdbc.sql("select achievement_id, unlocked_at from player_achievements where user_id = :id")
                .param("id", userId)
                .query((rs, row) -> Map.entry(rs.getString("achievement_id"), rs.getTimestamp("unlocked_at").toInstant()))
                .list()
                .stream()
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    /** Returns false when the achievement was already unlocked. */
    public boolean unlock(UUID userId, String achievementId, Instant now) {
        return jdbc.sql("""
                        insert into player_achievements (user_id, achievement_id, unlocked_at)
                        values (:id, :achievement, :now) on conflict do nothing""")
                .param("id", userId).param("achievement", achievementId).param("now", Timestamp.from(now))
                .update() == 1;
    }
}
