package com.mandat.api.pack;

import com.mandat.api.card.CatalogProperties;
import com.mandat.api.card.Continent;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Boosters of the current season: the standard booster plus one themed booster per continent,
 * unlocked with the player level. Prepared for paid boosters later (a price field would go here).
 */
@Component
public class PackCatalog {

    private final List<PackDefinition> packs;

    public PackCatalog(CatalogProperties properties) {
        String prefix = "s" + properties.season() + "-";
        this.packs = List.of(
                new PackDefinition(prefix + "standard", null, 1),
                new PackDefinition(prefix + "europe", Continent.EUROPE, 3),
                new PackDefinition(prefix + "africa", Continent.AFRICA, 4),
                new PackDefinition(prefix + "asia", Continent.ASIA, 5),
                new PackDefinition(prefix + "north-america", Continent.NORTH_AMERICA, 6),
                new PackDefinition(prefix + "south-america", Continent.SOUTH_AMERICA, 7),
                new PackDefinition(prefix + "oceania", Continent.OCEANIA, 8));
    }

    public List<PackDefinition> all() {
        return packs;
    }

    public Optional<PackDefinition> find(String packId) {
        return packs.stream().filter(pack -> pack.id().equals(packId)).findFirst();
    }

    /** @param continent null for the standard booster (whole season) */
    public record PackDefinition(String id, Continent continent, int requiredLevel) {}
}
