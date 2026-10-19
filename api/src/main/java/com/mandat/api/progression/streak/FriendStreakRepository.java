package com.mandat.api.progression.streak;

import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** {@code friend_streaks}: one row per pair (user_a &lt; user_b). */
@Repository
public class FriendStreakRepository {

    public enum Status { pending, active }

    public record Row(
            UUID id,
            UUID userA,
            UUID userB,
            UUID requestedBy,
            Status status,
            int current,
            int best,
            LocalDate lastSharedDay,
            int bestMilestone,
            Instant createdAt,
            Instant acceptedAt) {

        public UUID partnerOf(UUID userId) {
            return userA.equals(userId) ? userB : userA;
        }

        public boolean involves(UUID userId) {
            return userA.equals(userId) || userB.equals(userId);
        }
    }

    private static final String COLUMNS = """
            id, user_a, user_b, requested_by, status, current, best, last_shared_day, best_milestone,
            created_at, accepted_at""";

    private final JdbcClient jdbc;

    FriendStreakRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<Row> forUser(UUID userId) {
        return jdbc.sql("select " + COLUMNS + " from friend_streaks where user_a = :id or user_b = :id order by created_at")
                .param("id", userId).query(FriendStreakRepository::map).list();
    }

    public List<Row> active(UUID userId) {
        return jdbc.sql("select " + COLUMNS + " from friend_streaks where status = 'active' and (user_a = :id or user_b = :id)")
                .param("id", userId).query(FriendStreakRepository::map).list();
    }

    public List<Row> allActive() {
        return jdbc.sql("select " + COLUMNS + " from friend_streaks where status = 'active' and current > 0")
                .query(FriendStreakRepository::map).list();
    }

    public Optional<Row> lock(UUID id) {
        return jdbc.sql("select " + COLUMNS + " from friend_streaks where id = :id for update")
                .param("id", id).query(FriendStreakRepository::map).optional();
    }

    public Optional<Row> between(UUID a, UUID b) {
        return jdbc.sql("select " + COLUMNS + " from friend_streaks where user_a = :a and user_b = :b for update")
                .param("a", first(a, b)).param("b", second(a, b)).query(FriendStreakRepository::map).optional();
    }

    public int count(UUID userId) {
        return jdbc.sql("select count(*) from friend_streaks where user_a = :id or user_b = :id")
                .param("id", userId).query(Integer.class).single();
    }

    public int countActive(UUID userId) {
        return jdbc.sql("select count(*) from friend_streaks where status = 'active' and (user_a = :id or user_b = :id)")
                .param("id", userId).query(Integer.class).single();
    }

    /** False when a row already exists for the pair (concurrent invitation). */
    public boolean insertInvite(UUID inviter, UUID invitee, Instant now) {
        return jdbc.sql("""
                        insert into friend_streaks (user_a, user_b, requested_by, status, created_at)
                        values (:a, :b, :by, 'pending', :now) on conflict do nothing""")
                .param("a", first(inviter, invitee)).param("b", second(inviter, invitee))
                .param("by", inviter).param("now", Timestamp.from(now))
                .update() == 1;
    }

    public void activate(UUID id, Instant now) {
        jdbc.sql("update friend_streaks set status = 'active', accepted_at = :now where id = :id")
                .param("now", Timestamp.from(now)).param("id", id).update();
    }

    public void updateCount(UUID id, int current, int best, LocalDate lastSharedDay, int bestMilestone) {
        jdbc.sql("""
                        update friend_streaks set current = :current, best = :best, last_shared_day = :day,
                            best_milestone = :milestone where id = :id""")
                .param("current", current).param("best", best).param("day", Date.valueOf(lastSharedDay))
                .param("milestone", bestMilestone).param("id", id).update();
    }

    public boolean delete(UUID id) {
        return jdbc.sql("delete from friend_streaks where id = :id").param("id", id).update() == 1;
    }

    // Postgres orders uuids byte by byte, like their lowercase hex strings (not like UUID.compareTo).
    private static UUID first(UUID a, UUID b) {
        return a.toString().compareTo(b.toString()) < 0 ? a : b;
    }

    private static UUID second(UUID a, UUID b) {
        return a.toString().compareTo(b.toString()) < 0 ? b : a;
    }

    private static Row map(ResultSet rs, int row) throws SQLException {
        Date last = rs.getDate("last_shared_day");
        Timestamp accepted = rs.getTimestamp("accepted_at");
        return new Row(
                rs.getObject("id", UUID.class),
                rs.getObject("user_a", UUID.class),
                rs.getObject("user_b", UUID.class),
                rs.getObject("requested_by", UUID.class),
                Status.valueOf(rs.getString("status")),
                rs.getInt("current"),
                rs.getInt("best"),
                last == null ? null : last.toLocalDate(),
                rs.getInt("best_milestone"),
                rs.getTimestamp("created_at").toInstant(),
                accepted == null ? null : accepted.toInstant());
    }
}
