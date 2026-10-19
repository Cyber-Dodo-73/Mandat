package com.mandat.api.profile;

import com.mandat.api.card.CardFinish;
import com.mandat.api.profile.dto.ProfileDtos.CardRef;
import com.mandat.api.profile.dto.ProfileDtos.Visibility;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Profile rows, showcase and the read-only lookups profiles need from other domains' tables. */
@Repository
class ProfileRepository {

    record ProfileRow(String avatarId, String bannerId, String titleId, CardRef favoriteCard, Visibility visibility) {}

    private final JdbcClient jdbc;

    ProfileRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Creates the profile row with default cosmetics on first access. */
    ProfileRow findOrCreate(UUID userId) {
        jdbc.sql("insert into profiles (user_id) values (:id) on conflict do nothing").param("id", userId).update();
        return jdbc.sql("""
                select avatar_id, banner_id, title_id, favorite_card_id, favorite_finish, visibility
                from profiles where user_id = :id
                """)
                .param("id", userId)
                .query((rs, row) -> new ProfileRow(
                        rs.getString("avatar_id"),
                        rs.getString("banner_id"),
                        rs.getString("title_id"),
                        rs.getString("favorite_card_id") == null
                                ? null
                                : new CardRef(rs.getString("favorite_card_id"), CardFinish.fromKey(rs.getString("favorite_finish"))),
                        Visibility.fromKey(rs.getString("visibility"))))
                .single();
    }

    void update(UUID userId, String avatarId, String bannerId, String titleId, CardRef favorite, Visibility visibility) {
        jdbc.sql("""
                update profiles set avatar_id = :avatar, banner_id = :banner, title_id = :title,
                       favorite_card_id = :favCard, favorite_finish = :favFinish, visibility = :visibility,
                       updated_at = now()
                where user_id = :id
                """)
                .param("id", userId)
                .param("avatar", avatarId)
                .param("banner", bannerId)
                .param("title", titleId)
                .param("favCard", favorite == null ? null : favorite.cardId())
                .param("favFinish", favorite == null ? null : favorite.finish().key())
                .param("visibility", visibility.key())
                .update();
    }

    /** Showcase in display order, keeping only entries the player still owns. */
    List<CardRef> showcase(UUID userId) {
        return jdbc.sql("""
                select s.card_id, s.finish from profile_showcase s
                join collection_items c on c.user_id = s.user_id and c.card_id = s.card_id and c.finish = s.finish
                where s.user_id = :id order by s.position
                """)
                .param("id", userId)
                .query((rs, row) -> new CardRef(rs.getString("card_id"), CardFinish.fromKey(rs.getString("finish"))))
                .list();
    }

    void replaceShowcase(UUID userId, List<CardRef> showcase) {
        jdbc.sql("delete from profile_showcase where user_id = :id").param("id", userId).update();
        for (int position = 0; position < showcase.size(); position++) {
            CardRef card = showcase.get(position);
            jdbc.sql("insert into profile_showcase (user_id, position, card_id, finish) values (:id, :pos, :card, :finish)")
                    .param("id", userId)
                    .param("pos", position)
                    .param("card", card.cardId())
                    .param("finish", card.finish().key())
                    .update();
        }
    }

    boolean owns(UUID userId, CardRef card) {
        return jdbc.sql("select exists(select 1 from collection_items where user_id = :id and card_id = :card and finish = :finish)")
                .param("id", userId)
                .param("card", card.cardId())
                .param("finish", card.finish().key())
                .query(Boolean.class)
                .single();
    }

    /** Unlocked cosmetic ids of one kind ({@code avatar}, {@code banner}, {@code title}), oldest first. */
    List<String> unlocks(UUID userId, String kind) {
        return jdbc.sql("select item_id from player_unlocks where user_id = :id and kind = :kind order by unlocked_at, item_id")
                .param("id", userId)
                .param("kind", kind)
                .query(String.class)
                .list();
    }

    record CollectionCounts(int distinctCards, int legendaryCards, int mythicCards) {}

    CollectionCounts collectionCounts(UUID userId, int season) {
        return jdbc.sql("""
                select count(distinct c.id) as distinct_cards,
                       count(distinct c.id) filter (where c.rarity = 'legendary') as legendary_cards,
                       count(distinct c.id) filter (where c.rarity = 'mythic') as mythic_cards
                from collection_items i join cards c on c.id = i.card_id
                where i.user_id = :id and c.season = :season
                """)
                .param("id", userId)
                .param("season", season)
                .query((rs, row) -> new CollectionCounts(
                        rs.getInt("distinct_cards"), rs.getInt("legendary_cards"), rs.getInt("mythic_cards")))
                .single();
    }

    int seasonCards(int season) {
        return jdbc.sql("select count(*) from cards where season = :season and active")
                .param("season", season)
                .query(Integer.class)
                .single();
    }

    record ActivityCounts(int packsOpened, int bestStreak, int duelWins) {}

    ActivityCounts activity(UUID userId) {
        return jdbc.sql("""
                select coalesce((select packs_opened from pack_states where user_id = :id), 0) as packs_opened,
                       coalesce((select best_streak from player_progress where user_id = :id), 0) as best_streak,
                       coalesce((select duels_won from player_stats where user_id = :id), 0) as duel_wins
                """)
                .param("id", userId)
                .query((rs, row) -> new ActivityCounts(rs.getInt("packs_opened"), rs.getInt("best_streak"), rs.getInt("duel_wins")))
                .single();
    }

    /** Owned card ids with their finishes, for collection comparison. */
    List<OwnedCard> ownedCards(UUID userId) {
        return jdbc.sql("select card_id, finish from collection_items where user_id = :id order by card_id, finish")
                .param("id", userId)
                .query((rs, row) -> new OwnedCard(rs.getString("card_id"), CardFinish.fromKey(rs.getString("finish"))))
                .list();
    }

    record OwnedCard(String cardId, CardFinish finish) {}
}
