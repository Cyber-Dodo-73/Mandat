package com.mandat.api.progression;

import com.mandat.api.progression.Reward.Unlock;
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

/** {@code player_progress}, {@code player_stats} and {@code player_unlocks}. */
@Repository
public class ProgressRepository {

    private static final String PROGRESS_COLUMNS = """
            user_id, total_xp, level, season_id, season_xp, current_streak, best_streak,
            last_active_day, last_freeze_week""";

    private final JdbcClient jdbc;

    public ProgressRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Creates the player's rows if missing and resets the season XP when a new season started. */
    public void ensure(UUID userId, String seasonId) {
        jdbc.sql("insert into player_progress (user_id, season_id) values (:id, :season) on conflict do nothing")
                .param("id", userId).param("season", seasonId).update();
        jdbc.sql("insert into player_stats (user_id) values (:id) on conflict do nothing")
                .param("id", userId).update();
        jdbc.sql("update player_progress set season_id = :season, season_xp = 0 where user_id = :id and season_id <> :season")
                .param("id", userId).param("season", seasonId).update();
    }

    public Optional<PlayerProgress> find(UUID userId) {
        return jdbc.sql("select " + PROGRESS_COLUMNS + " from player_progress where user_id = :id")
                .param("id", userId)
                .query(ProgressRepository::mapProgress)
                .optional();
    }

    /** Reads the row with a write lock: progression mutations of one player are serialized. */
    public PlayerProgress lock(UUID userId) {
        return jdbc.sql("select " + PROGRESS_COLUMNS + " from player_progress where user_id = :id for update")
                .param("id", userId)
                .query(ProgressRepository::mapProgress)
                .single();
    }

    public void updateXp(UUID userId, int totalXp, int level, int seasonXp, Instant now) {
        jdbc.sql("""
                        update player_progress
                        set total_xp = :xp, level = :level, season_xp = :seasonXp, updated_at = :now
                        where user_id = :id""")
                .param("xp", totalXp).param("level", level).param("seasonXp", seasonXp)
                .param("now", Timestamp.from(now)).param("id", userId)
                .update();
    }

    public void updateStreak(UUID userId, int current, int best, LocalDate lastActiveDay, String lastFreezeWeek, Instant now) {
        jdbc.sql("""
                        update player_progress
                        set current_streak = :current, best_streak = :best, last_active_day = :day,
                            last_freeze_week = :freezeWeek, updated_at = :now
                        where user_id = :id""")
                .param("current", current).param("best", best)
                .param("day", lastActiveDay == null ? null : Date.valueOf(lastActiveDay))
                .param("freezeWeek", lastFreezeWeek)
                .param("now", Timestamp.from(now)).param("id", userId)
                .update();
    }

    public PlayerStats stats(UUID userId) {
        return jdbc.sql("""
                        select packs_opened, new_cards, rare_plus_pulled, quizzes_completed, perfect_quizzes,
                               duels_played, duels_won, cards_recycled, cards_crafted
                        from player_stats where user_id = :id""")
                .param("id", userId)
                .query((rs, row) -> new PlayerStats(
                        rs.getInt("packs_opened"), rs.getInt("new_cards"), rs.getInt("rare_plus_pulled"),
                        rs.getInt("quizzes_completed"), rs.getInt("perfect_quizzes"), rs.getInt("duels_played"),
                        rs.getInt("duels_won"), rs.getInt("cards_recycled"), rs.getInt("cards_crafted")))
                .optional()
                .orElse(PlayerStats.ZERO);
    }

    public void incrementStats(UUID userId, PlayerStats delta) {
        jdbc.sql("""
                        update player_stats set
                            packs_opened = packs_opened + :packs,
                            new_cards = new_cards + :newCards,
                            rare_plus_pulled = rare_plus_pulled + :rarePlus,
                            quizzes_completed = quizzes_completed + :quizzes,
                            perfect_quizzes = perfect_quizzes + :perfect,
                            duels_played = duels_played + :duelsPlayed,
                            duels_won = duels_won + :duelsWon,
                            cards_recycled = cards_recycled + :recycled,
                            cards_crafted = cards_crafted + :crafted
                        where user_id = :id""")
                .param("packs", delta.packsOpened()).param("newCards", delta.newCards())
                .param("rarePlus", delta.rarePlusPulled()).param("quizzes", delta.quizzesCompleted())
                .param("perfect", delta.perfectQuizzes()).param("duelsPlayed", delta.duelsPlayed())
                .param("duelsWon", delta.duelsWon()).param("recycled", delta.cardsRecycled())
                .param("crafted", delta.cardsCrafted()).param("id", userId)
                .update();
    }

    /** Returns false when the player already owned the item. */
    public boolean addUnlock(UUID userId, Unlock unlock, String source, Instant now) {
        return jdbc.sql("""
                        insert into player_unlocks (user_id, kind, item_id, source, unlocked_at)
                        values (:id, :kind, :item, :source, :now) on conflict do nothing""")
                .param("id", userId).param("kind", unlock.kind().name()).param("item", unlock.itemId())
                .param("source", source).param("now", Timestamp.from(now))
                .update() == 1;
    }

    public List<Unlock> unlocks(UUID userId) {
        return jdbc.sql("select kind, item_id from player_unlocks where user_id = :id order by unlocked_at, item_id")
                .param("id", userId)
                .query((rs, row) -> new Unlock(Unlock.Kind.valueOf(rs.getString("kind")), rs.getString("item_id")))
                .list();
    }

    private static PlayerProgress mapProgress(ResultSet rs, int row) throws SQLException {
        Date lastDay = rs.getDate("last_active_day");
        return new PlayerProgress(
                rs.getObject("user_id", UUID.class),
                rs.getInt("total_xp"),
                rs.getInt("level"),
                rs.getString("season_id"),
                rs.getInt("season_xp"),
                rs.getInt("current_streak"),
                rs.getInt("best_streak"),
                lastDay == null ? null : lastDay.toLocalDate(),
                rs.getString("last_freeze_week"));
    }
}
