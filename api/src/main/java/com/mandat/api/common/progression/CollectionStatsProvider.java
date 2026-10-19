package com.mandat.api.common.progression;

import java.util.UUID;

/**
 * Collection counts used by collection-based achievements. Implemented by the collection domain
 * (register it as a bean); while no implementation exists, progression uses {@link #NONE}, so
 * collection achievements stay at 0 progress.
 *
 * <p>Keys: continents {@code europe, asia, africa, north_america, south_america, oceania}; eras
 * {@code antiquity, medieval, modern, contemporary}; rarities {@code common … mythic}; finishes
 * {@code standard, holo, full_art, gold}.
 */
public interface CollectionStatsProvider {

    /** Distinct cards owned, any finish. */
    int distinctCards(UUID userId);

    int distinctCardsByContinent(UUID userId, String continent);

    int distinctCardsByEra(UUID userId, String era);

    int distinctCardsByRarity(UUID userId, String rarity);

    /** Distinct cards owned in the given finish. */
    int distinctCardsByFinish(UUID userId, String finish);

    CollectionStatsProvider NONE = new CollectionStatsProvider() {
        @Override
        public int distinctCards(UUID userId) {
            return 0;
        }

        @Override
        public int distinctCardsByContinent(UUID userId, String continent) {
            return 0;
        }

        @Override
        public int distinctCardsByEra(UUID userId, String era) {
            return 0;
        }

        @Override
        public int distinctCardsByRarity(UUID userId, String rarity) {
            return 0;
        }

        @Override
        public int distinctCardsByFinish(UUID userId, String finish) {
            return 0;
        }
    };
}
