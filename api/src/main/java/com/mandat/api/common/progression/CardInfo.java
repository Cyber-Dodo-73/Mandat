package com.mandat.api.common.progression;

/** Catalog facts about a card that progression needs (keys match cards.season1.json). */
public record CardInfo(String cardId, String rarity, String continent, String era) {

    public boolean isRareOrBetter() {
        return switch (rarity) {
            case "rare", "epic", "legendary", "mythic" -> true;
            default -> false;
        };
    }
}
