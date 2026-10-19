package com.mandat.api.card;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/** Shape of {@code data/cards.season<N>.json}, produced by scripts/build-cards. */
@JsonIgnoreProperties(ignoreUnknown = true)
record CatalogFile(int season, String version, List<Entry> cards) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Entry(
            String id,
            String wikidataId,
            int number,
            Text name,
            Text role,
            String country,
            Continent continent,
            Era era,
            Integer birthYear,
            Integer deathYear,
            boolean isLiving,
            double fameScore,
            Rarity rarity,
            Text bio,
            Stats stats,
            Ability ability,
            boolean sensitive,
            String artwork) {}

    record Text(String fr, String en) {}

    record Stats(int influence, int diplomacy, int charisma, int strategy) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Ability(Text name, Text description, Effect effect) {}

    /** {@code condition.value} is a string or a number (round) in the file. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    record Effect(String type, String stat, Integer amount, Condition condition) {}

    record Condition(String kind, Object value) {}
}
