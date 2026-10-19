package com.mandat.api.common.progression;

import java.util.Optional;

/**
 * Looks up catalog facts for a card id. Implemented by the card domain (register it as a bean);
 * until it exists, progression treats every card as unknown, so rarity- and continent-based
 * missions don't progress.
 */
public interface CardInfoProvider {

    Optional<CardInfo> find(String cardId);

    CardInfoProvider NONE = cardId -> Optional.empty();
}
