package com.mandat.api.card;

import com.mandat.api.common.progression.CardInfo;
import com.mandat.api.common.progression.CardInfoProvider;
import java.util.Optional;
import org.springframework.stereotype.Component;

/** Exposes catalog facts (rarity, continent, era) to progression missions and achievements. */
@Component
class CatalogCardInfoProvider implements CardInfoProvider {

    private final CardCatalogService catalog;

    CatalogCardInfoProvider(CardCatalogService catalog) {
        this.catalog = catalog;
    }

    @Override
    public Optional<CardInfo> find(String cardId) {
        return catalog.find(cardId)
                .map(card -> new CardInfo(card.getId(), card.getRarity().key(), card.getContinent().key(), card.getEra().key()));
    }
}
