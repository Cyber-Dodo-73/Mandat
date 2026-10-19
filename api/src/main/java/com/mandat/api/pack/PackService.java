package com.mandat.api.pack;

import com.mandat.api.card.Card;
import com.mandat.api.card.CardCatalogService;
import com.mandat.api.card.CardFinish;
import com.mandat.api.card.CatalogProperties;
import com.mandat.api.card.Rarity;
import com.mandat.api.collection.CollectionService;
import com.mandat.api.collection.CollectionService.Added;
import com.mandat.api.collection.CollectionService.Grant;
import com.mandat.api.collection.EconomyRules;
import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.common.events.PackOpenedEvent;
import com.mandat.api.common.progression.PlayerLevelProvider;
import com.mandat.api.common.wallet.WalletService;
import com.mandat.api.common.wallet.WalletSource;
import com.mandat.api.pack.PackCatalog.PackDefinition;
import com.mandat.api.pack.draw.CardPool;
import com.mandat.api.pack.draw.DrawCard;
import com.mandat.api.pack.draw.DrawEngine;
import com.mandat.api.pack.draw.DrawOdds;
import com.mandat.api.pack.draw.FirstPackRules;
import com.mandat.api.pack.draw.FirstPackRulesLoader;
import com.mandat.api.pack.draw.PackDraw;
import com.mandat.api.pack.draw.PityCounters;
import com.mandat.api.pack.dto.PackDtos.DrawnCardDto;
import com.mandat.api.pack.dto.PackDtos.FinishOddsDto;
import com.mandat.api.pack.dto.PackDtos.FirstPackSlotDto;
import com.mandat.api.pack.dto.PackDtos.NewPlayerGuaranteesDto;
import com.mandat.api.pack.dto.PackDtos.FreePacksDto;
import com.mandat.api.pack.dto.PackDtos.OddsResponse;
import com.mandat.api.pack.dto.PackDtos.OpenPackResponse;
import com.mandat.api.pack.dto.PackDtos.PackDto;
import com.mandat.api.pack.dto.PackDtos.PacksResponse;
import com.mandat.api.pack.dto.PackDtos.PityDto;
import com.mandat.api.pack.dto.PackDtos.PityRulesDto;
import com.mandat.api.pack.dto.PackDtos.RarityOddsDto;
import com.mandat.api.pack.dto.PackDtos.SlotOddsDto;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * Boosters: stock and timers, odds, and the server-side opening. Opening a booster is one
 * transaction: consume the booster, draw, add to the collection, pity, Influence, event.
 */
@Service
public class PackService {

    private final PackCatalog packCatalog;
    private final PackStateRepository stateRepository;
    private final PackOpeningRepository openingRepository;
    private final CardCatalogService cardCatalog;
    private final CatalogProperties catalogProperties;
    private final CollectionService collectionService;
    private final WalletService walletService;
    private final DrawEngine drawEngine;
    private final FirstPackRulesLoader firstPackRules;
    private final ObjectProvider<PlayerLevelProvider> levelProvider;
    private final ApplicationEventPublisher events;
    private final JdbcClient jdbc;
    private final JsonMapper jsonMapper;
    private final Clock clock;

    public PackService(
            PackCatalog packCatalog,
            PackStateRepository stateRepository,
            PackOpeningRepository openingRepository,
            CardCatalogService cardCatalog,
            CatalogProperties catalogProperties,
            CollectionService collectionService,
            WalletService walletService,
            DrawEngine drawEngine,
            FirstPackRulesLoader firstPackRules,
            ObjectProvider<PlayerLevelProvider> levelProvider,
            ApplicationEventPublisher events,
            JdbcClient jdbc,
            JsonMapper jsonMapper,
            Clock clock) {
        this.packCatalog = packCatalog;
        this.stateRepository = stateRepository;
        this.openingRepository = openingRepository;
        this.cardCatalog = cardCatalog;
        this.catalogProperties = catalogProperties;
        this.collectionService = collectionService;
        this.walletService = walletService;
        this.drawEngine = drawEngine;
        this.firstPackRules = firstPackRules;
        this.levelProvider = levelProvider;
        this.events = events;
        this.jdbc = jdbc;
        this.jsonMapper = jsonMapper;
        this.clock = clock;
    }

    @Transactional
    public PacksResponse overview(UUID userId) {
        Instant now = now();
        PackState state = state(userId, now, false);
        int level = level(userId);
        List<PackDto> packs = packCatalog.all().stream()
                .map(pack -> new PackDto(pack.id(), pack.continent(), pack.requiredLevel(), level >= pack.requiredLevel()))
                .toList();
        return new PacksResponse(
                packs, freePacks(state, now), walletService.balance(userId).bonusPacks(), pity(state));
    }

    public OddsResponse odds(String packId) {
        PackDefinition pack = pack(packId);
        List<FinishOddsDto> finishes = List.of(
                new FinishOddsDto(CardFinish.GOLD, percent(DrawOdds.GOLD_CHANCE), false, null),
                new FinishOddsDto(CardFinish.FULL_ART, percent(DrawOdds.FULL_ART_CHANCE), true, DrawOdds.FULL_ART_MIN_RARITY),
                new FinishOddsDto(CardFinish.HOLO, percent(DrawOdds.HOLO_CHANCE), false, null));
        return new OddsResponse(
                pack.id(),
                List.of(
                        new SlotOddsDto(List.of(1, 2, 3, 4), rarityOdds(DrawOdds.REGULAR_SLOT)),
                        new SlotOddsDto(List.of(5), rarityOdds(DrawOdds.GUARANTEED_SLOT))),
                finishes,
                new PityRulesDto(DrawOdds.EPIC_PITY_PACKS, DrawOdds.LEGENDARY_PITY_PACKS),
                pack.continent() != null,
                newPlayerGuarantees(firstPackRules.rules()));
    }

    @Transactional
    public OpenPackResponse open(UUID userId, String packId, String idempotencyKey) {
        PackDefinition pack = pack(packId);
        Instant now = now();
        PackState state = state(userId, now, true);

        Optional<PackOpening> previous = openingRepository.findByUserIdAndIdempotencyKey(userId, idempotencyKey);
        if (previous.isPresent()) {
            if (!previous.get().getPackId().equals(packId)) {
                throw new ApiException(ErrorCode.IDEMPOTENCY_KEY_REUSED, "This Idempotency-Key was used for another booster");
            }
            return jsonMapper.readValue(previous.get().getResponse(), OpenPackResponse.class);
        }

        if (level(userId) < pack.requiredLevel()) {
            throw new ApiException(ErrorCode.PACK_LOCKED);
        }
        consumeOneBooster(userId, state, now);

        boolean firstPack = state.getPacksOpened() == 0;
        CardPool pool = pool(pack);
        PackDraw draw = firstPack
                ? drawEngine.drawFirstPack(pool, firstPackRules.rules(), state.pity())
                : drawEngine.draw(pool, state.pity(), state.pity().newPlayerMinimum(state.getPacksOpened()));

        List<Added> added = collectionService.addAll(userId, draw.cards().stream()
                .map(drawn -> new Grant(drawn.card().id(), drawn.finish()))
                .toList());
        List<DrawnCardDto> cards = new ArrayList<>(added.size());
        int influence = 0;
        for (int i = 0; i < added.size(); i++) {
            PackDraw.DrawnCard drawn = draw.cards().get(i);
            Added result = added.get(i);
            int bonus = result.newCard() ? 0 : EconomyRules.duplicateBonus(drawn.card().rarity(), drawn.finish());
            influence += bonus;
            cards.add(new DrawnCardDto(
                    i + 1, drawn.card().id(), drawn.card().rarity(), drawn.finish(),
                    result.newCard(), result.newFinish(), bonus));
        }
        if (influence > 0) {
            walletService.addInfluence(userId, influence, WalletSource.PACK_DUPLICATES);
        }
        state.recordOpening(draw.pityAfter());

        events.publishEvent(new PackOpenedEvent(
                userId,
                packId,
                cards.stream().map(DrawnCardDto::cardId).toList(),
                cards.stream().filter(DrawnCardDto::isNew).map(DrawnCardDto::cardId).toList(),
                now));

        OpenPackResponse response = new OpenPackResponse(
                UUID.randomUUID(), packId, cards, influence, firstPack, pity(state),
                freePacks(state, now), walletService.balance(userId).bonusPacks(), now);
        openingRepository.save(new PackOpening(
                response.openingId(), userId, packId, idempotencyKey, jsonMapper.writeValueAsString(response), now));
        return response;
    }

    /** Free boosters first, then bonus boosters granted by rewards. */
    private void consumeOneBooster(UUID userId, PackState state, Instant now) {
        if (FreePackTimer.available(state.getFreePacksAnchor(), now) > 0) {
            state.consumeFreePack(FreePackTimer.consume(state.getFreePacksAnchor(), now));
        } else if (!walletService.consumeBonusPack(userId, WalletSource.PACK_OPEN)) {
            throw new ApiException(ErrorCode.NO_PACK_AVAILABLE);
        }
    }

    /**
     * Server time at the database's precision: Postgres keeps microseconds and rounds the rest,
     * so a nanosecond anchor could be stored a hair later than computed and show one free
     * booster less (and a "next booster now") until the clock moves on.
     */
    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }

    private PackState state(UUID userId, Instant now, boolean lock) {
        jdbc.sql("insert into pack_states (user_id, free_packs_anchor) values (:userId, :anchor) on conflict do nothing")
                .param("userId", userId)
                .param("anchor", Timestamp.from(FreePackTimer.initialAnchor(now)))
                .update();
        Optional<PackState> state = lock ? stateRepository.lockByUserId(userId) : stateRepository.findById(userId);
        return state.orElseThrow(() -> new IllegalStateException("Pack state missing for " + userId));
    }

    private CardPool pool(PackDefinition pack) {
        List<Card> cards = cardCatalog.activeCards(catalogProperties.season());
        CardPool pool = CardPool.of(cards.stream()
                .map(card -> new DrawCard(card.getId(), card.getRarity(), card.getContinent(), card.getEra(), card.isSensitive()))
                .toList());
        if (pool.isEmpty()) {
            throw new IllegalStateException("Card catalog is empty: was it seeded?");
        }
        return pack.continent() == null ? pool : pool.restrictedTo(pack.continent());
    }

    private PackDefinition pack(String packId) {
        return packCatalog.find(packId).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Unknown booster"));
    }

    private int level(UUID userId) {
        PlayerLevelProvider provider = levelProvider.getIfAvailable();
        return provider == null ? 1 : provider.levelOf(userId);
    }

    private static FreePacksDto freePacks(PackState state, Instant now) {
        return new FreePacksDto(
                FreePackTimer.available(state.getFreePacksAnchor(), now),
                FreePackTimer.MAX_STOCK,
                FreePackTimer.nextAt(state.getFreePacksAnchor(), now),
                FreePackTimer.INTERVAL.toSeconds());
    }

    private static PityDto pity(PackState state) {
        PityCounters pity = state.pity();
        return new PityDto(
                pity.packsSinceEpic(),
                DrawOdds.EPIC_PITY_PACKS - pity.packsSinceEpic(),
                pity.packsSinceLegendary(),
                DrawOdds.LEGENDARY_PITY_PACKS - pity.packsSinceLegendary(),
                pity.newPlayerLegendaryIn(state.getPacksOpened()));
    }

    /** Published first-boosters guarantees, built from the same rules the engine applies. */
    private static NewPlayerGuaranteesDto newPlayerGuarantees(FirstPackRules rules) {
        // Groups laid out by ascending rarity, as the engine does with the drawn cards.
        List<FirstPackRules.SlotGroup> groups = rules.slots().stream()
                .sorted(Comparator.comparing(group -> group.rarities().stream().min(Comparator.naturalOrder()).orElseThrow()))
                .toList();
        List<FirstPackSlotDto> slots = new ArrayList<>(groups.size());
        int next = 1;
        for (FirstPackRules.SlotGroup group : groups) {
            List<Integer> numbers = new ArrayList<>(group.count());
            for (int i = 0; i < group.count(); i++) {
                numbers.add(next++);
            }
            slots.add(new FirstPackSlotDto(numbers, group.rarities().stream().sorted().toList()));
        }
        return new NewPlayerGuaranteesDto(
                slots,
                DrawOdds.FIRST_PACK_BEST_FINISH,
                rules.distinctContinents(),
                rules.minDistinctEras(),
                rules.excludeSensitive(),
                DrawOdds.NEW_PLAYER_LEGENDARY_WITHIN_PACKS);
    }

    private static List<RarityOddsDto> rarityOdds(Map<Rarity, Double> weights) {
        return weights.entrySet().stream().map(entry -> new RarityOddsDto(entry.getKey(), entry.getValue())).toList();
    }

    private static double percent(double chance) {
        return Math.round(chance * 100_000) / 1_000.0;
    }
}
