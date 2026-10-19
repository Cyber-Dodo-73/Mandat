package com.mandat.api.progression.mission;

import com.mandat.api.progression.mission.MissionCatalog.Period;
import com.mandat.api.progression.mission.MissionCatalog.Template;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class MissionRepository {

    private static final String COLUMNS =
            "id, period, period_key, template_id, type, param, target, progress, completed_at, claimed_at";

    private final JdbcClient jdbc;

    public MissionRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public record MissionRow(
            UUID id,
            Period period,
            String periodKey,
            String templateId,
            MissionType type,
            String param,
            int target,
            int progress,
            Instant completedAt,
            Instant claimedAt) {}

    public boolean hasMissions(UUID userId, String periodKey) {
        return jdbc.sql("select exists (select 1 from player_missions where user_id = :id and period_key = :key)")
                .param("id", userId).param("key", periodKey)
                .query(Boolean.class)
                .single();
    }

    public void insert(UUID userId, String periodKey, Template template) {
        jdbc.sql("""
                        insert into player_missions (user_id, period, period_key, template_id, type, param, target)
                        values (:id, :period, :key, :template, :type, :param, :target)
                        on conflict do nothing""")
                .param("id", userId).param("period", template.period().name()).param("key", periodKey)
                .param("template", template.id()).param("type", template.type().name())
                .param("param", template.param()).param("target", template.target())
                .update();
    }

    public List<MissionRow> list(UUID userId, Collection<String> periodKeys) {
        return jdbc.sql("select " + COLUMNS + " from player_missions where user_id = :id and period_key in (:keys)"
                        + " order by period, template_id")
                .param("id", userId).param("keys", periodKeys)
                .query(MissionRepository::map)
                .list();
    }

    public Optional<MissionRow> find(UUID userId, UUID missionId) {
        return jdbc.sql("select " + COLUMNS + " from player_missions where id = :mission and user_id = :id")
                .param("mission", missionId).param("id", userId)
                .query(MissionRepository::map)
                .optional();
    }

    /** Adds {@code amount} to the open missions of {@code type} (and {@code param} when given). */
    public void addProgress(UUID userId, Collection<String> periodKeys, MissionType type, String param, int amount, Instant now) {
        String paramFilter = param == null ? "" : " and param = :param";
        JdbcClient.StatementSpec spec = jdbc.sql("""
                        update player_missions set
                            completed_at = case when progress + :amount >= target then :now else completed_at end,
                            progress = least(target, progress + :amount)
                        where user_id = :id and period_key in (:keys) and type = :type and completed_at is null"""
                        + paramFilter)
                .param("amount", amount).param("now", Timestamp.from(now)).param("id", userId)
                .param("keys", periodKeys).param("type", type.name());
        if (param != null) {
            spec = spec.param("param", param);
        }
        spec.update();
    }

    /** Marks a completed, unclaimed mission of a current period as claimed. Returns false otherwise. */
    public boolean markClaimed(UUID userId, UUID missionId, Collection<String> periodKeys, Instant now) {
        return jdbc.sql("""
                        update player_missions set claimed_at = :now
                        where id = :mission and user_id = :id and period_key in (:keys)
                          and completed_at is not null and claimed_at is null""")
                .param("now", Timestamp.from(now)).param("mission", missionId).param("id", userId)
                .param("keys", periodKeys)
                .update() == 1;
    }

    private static MissionRow map(ResultSet rs, int row) throws SQLException {
        Timestamp completed = rs.getTimestamp("completed_at");
        Timestamp claimed = rs.getTimestamp("claimed_at");
        return new MissionRow(
                rs.getObject("id", UUID.class),
                Period.valueOf(rs.getString("period")),
                rs.getString("period_key"),
                rs.getString("template_id"),
                MissionType.valueOf(rs.getString("type")),
                rs.getString("param"),
                rs.getInt("target"),
                rs.getInt("progress"),
                completed == null ? null : completed.toInstant(),
                claimed == null ? null : claimed.toInstant());
    }
}
