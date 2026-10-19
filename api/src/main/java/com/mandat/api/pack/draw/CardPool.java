package com.mandat.api.pack.draw;

import com.mandat.api.card.Continent;
import com.mandat.api.card.Rarity;
import java.util.Collection;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Cards a booster can contain, indexed by rarity. */
public final class CardPool {

    private final Map<Rarity, List<DrawCard>> byRarity;

    private CardPool(Map<Rarity, List<DrawCard>> byRarity) {
        this.byRarity = byRarity;
    }

    public static CardPool of(Collection<DrawCard> cards) {
        EnumMap<Rarity, List<DrawCard>> map = new EnumMap<>(Rarity.class);
        for (Rarity rarity : Rarity.values()) {
            map.put(rarity, List.of());
        }
        map.putAll(cards.stream().collect(Collectors.groupingBy(DrawCard::rarity, Collectors.toUnmodifiableList())));
        return new CardPool(map);
    }

    /**
     * Pool of a continent booster. A rarity with no card from that continent falls back to the whole
     * season for that rarity, so the published odds stay true for every booster.
     */
    public CardPool restrictedTo(Continent continent) {
        EnumMap<Rarity, List<DrawCard>> map = new EnumMap<>(Rarity.class);
        byRarity.forEach((rarity, cards) -> {
            List<DrawCard> local = cards.stream().filter(card -> card.continent() == continent).toList();
            map.put(rarity, local.isEmpty() ? cards : local);
        });
        return new CardPool(map);
    }

    public List<DrawCard> cards(Rarity rarity) {
        return byRarity.get(rarity);
    }

    public boolean isEmpty() {
        return byRarity.values().stream().allMatch(List::isEmpty);
    }
}
