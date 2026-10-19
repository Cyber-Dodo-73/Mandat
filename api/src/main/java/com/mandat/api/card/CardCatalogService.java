package com.mandat.api.card;

import com.mandat.api.card.dto.CardDto;
import com.mandat.api.card.dto.CardDto.CardAbilityDto;
import com.mandat.api.card.dto.CardDto.CardStatsDto;
import com.mandat.api.card.dto.CardDto.LocalizedText;
import com.mandat.api.card.dto.CatalogResponse;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * Read side of the catalog. The catalog only changes at startup (seeding), so each season is
 * loaded once and kept in memory; the seeder evicts it after writing.
 */
@Service
public class CardCatalogService {

    private final CardRepository cardRepository;
    private final JdbcClient jdbc;
    private final Map<Integer, Snapshot> snapshots = new ConcurrentHashMap<>();

    public CardCatalogService(CardRepository cardRepository, JdbcClient jdbc) {
        this.cardRepository = cardRepository;
        this.jdbc = jdbc;
    }

    /** Empty when the season was never seeded. */
    public Optional<CatalogResponse> catalog(int season) {
        Snapshot snapshot = snapshot(season);
        return snapshot.version() == null
                ? Optional.empty()
                : Optional.of(new CatalogResponse(season, snapshot.version(), snapshot.dtos()));
    }

    /** Active cards of the season, used as the draw pool. */
    public List<Card> activeCards(int season) {
        return snapshot(season).cards().stream().filter(Card::isActive).toList();
    }

    public Optional<Card> find(String cardId) {
        for (Snapshot snapshot : snapshots.values()) {
            Card card = snapshot.byId().get(cardId);
            if (card != null) {
                return Optional.of(card);
            }
        }
        return cardRepository.findById(cardId);
    }

    void evict(int season) {
        snapshots.remove(season);
    }

    private Snapshot snapshot(int season) {
        return snapshots.computeIfAbsent(season, this::load);
    }

    private Snapshot load(int season) {
        String version = jdbc.sql("select content_hash from catalog_versions where season = :season")
                .param("season", season)
                .query(String.class)
                .optional()
                .orElse(null);
        List<Card> cards = cardRepository.findBySeasonOrderByNumber(season);
        Map<String, Card> byId = cards.stream().collect(Collectors.toMap(Card::getId, Function.identity()));
        return new Snapshot(version, cards, cards.stream().map(CardCatalogService::toDto).toList(), byId);
    }

    static CardDto toDto(Card card) {
        return new CardDto(
                card.getId(),
                card.getWikidataId(),
                card.getNumber(),
                new LocalizedText(card.getNameFr(), card.getNameEn()),
                new LocalizedText(card.getRoleFr(), card.getRoleEn()),
                card.getCountry(),
                card.getContinent(),
                card.getEra(),
                card.getBirthYear(),
                card.getDeathYear(),
                card.isLiving(),
                card.getFameScore(),
                card.getRarity(),
                new LocalizedText(card.getBioFr(), card.getBioEn()),
                new CardStatsDto(
                        card.getStatInfluence(), card.getStatDiplomacy(), card.getStatCharisma(), card.getStatStrategy()),
                new CardAbilityDto(
                        new LocalizedText(card.getAbilityNameFr(), card.getAbilityNameEn()),
                        new LocalizedText(card.getAbilityDescFr(), card.getAbilityDescEn())),
                card.isSensitive(),
                card.getArtwork(),
                card.isActive());
    }

    private record Snapshot(String version, List<Card> cards, List<CardDto> dtos, Map<String, Card> byId) {}
}
