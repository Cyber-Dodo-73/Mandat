package com.mandat.api.collection;

import com.mandat.api.common.progression.CollectionStatsProvider;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Distinct-card counts over the player's collection, for collection-based achievements. */
@Component
class CollectionStats implements CollectionStatsProvider {

    private final JdbcClient jdbc;

    CollectionStats(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public int distinctCards(UUID userId) {
        return count("select count(distinct card_id) from collection_items where user_id = :userId", userId, null);
    }

    @Override
    public int distinctCardsByContinent(UUID userId, String continent) {
        return count("""
                select count(distinct ci.card_id) from collection_items ci join cards c on c.id = ci.card_id
                where ci.user_id = :userId and c.continent = :value
                """, userId, continent);
    }

    @Override
    public int distinctCardsByEra(UUID userId, String era) {
        return count("""
                select count(distinct ci.card_id) from collection_items ci join cards c on c.id = ci.card_id
                where ci.user_id = :userId and c.era = :value
                """, userId, era);
    }

    @Override
    public int distinctCardsByRarity(UUID userId, String rarity) {
        return count("""
                select count(distinct ci.card_id) from collection_items ci join cards c on c.id = ci.card_id
                where ci.user_id = :userId and c.rarity = :value
                """, userId, rarity);
    }

    @Override
    public int distinctCardsByFinish(UUID userId, String finish) {
        return count("select count(distinct card_id) from collection_items where user_id = :userId and finish = :value",
                userId, finish);
    }

    private int count(String sql, UUID userId, String value) {
        var statement = jdbc.sql(sql).param("userId", userId);
        if (value != null) {
            statement = statement.param("value", value);
        }
        return statement.query(Integer.class).single();
    }
}
