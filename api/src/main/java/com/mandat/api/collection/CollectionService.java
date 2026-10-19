package com.mandat.api.collection;

import com.mandat.api.card.Card;
import com.mandat.api.card.CardCatalogService;
import com.mandat.api.card.CardFinish;
import com.mandat.api.collection.dto.CollectionDtos.CollectionResponse;
import com.mandat.api.collection.dto.CollectionDtos.CraftResponse;
import com.mandat.api.collection.dto.CollectionDtos.OwnedCardDto;
import com.mandat.api.collection.dto.CollectionDtos.RecycleResponse;
import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.common.events.CardCraftedEvent;
import com.mandat.api.common.events.CardsRecycledEvent;
import com.mandat.api.common.wallet.WalletService;
import com.mandat.api.common.wallet.WalletSource;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CollectionService {

    private final CollectionItemRepository repository;
    private final CardCatalogService catalogService;
    private final WalletService walletService;
    private final ApplicationEventPublisher events;
    private final JdbcClient jdbc;
    private final Clock clock;

    public CollectionService(
            CollectionItemRepository repository,
            CardCatalogService catalogService,
            WalletService walletService,
            ApplicationEventPublisher events,
            JdbcClient jdbc,
            Clock clock) {
        this.repository = repository;
        this.catalogService = catalogService;
        this.walletService = walletService;
        this.events = events;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public CollectionResponse collection(UUID userId) {
        List<OwnedCardDto> items = repository.findAllOwnedBy(userId).stream()
                .map(item -> new OwnedCardDto(
                        item.getKey().cardId(),
                        item.getKey().finish(),
                        item.getQuantity(),
                        item.getFirstObtainedAt(),
                        item.getLastObtainedAt()))
                .toList();
        int distinct = (int) items.stream().map(OwnedCardDto::cardId).distinct().count();
        int copies = items.stream().mapToInt(OwnedCardDto::quantity).sum();
        return new CollectionResponse(items, distinct, copies);
    }

    /**
     * Adds drawn cards in order, inside the caller's transaction. A card is "new" when the player
     * owned no copy of it (any finish) before it was added, including earlier cards of the same batch.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public List<Added> addAll(UUID userId, List<Grant> grants) {
        Instant now = clock.instant();
        Set<String> ownedCards = new HashSet<>();
        Set<String> ownedPairs = new HashSet<>();
        List<String> cardIds = grants.stream().map(Grant::cardId).distinct().toList();
        jdbc.sql("select card_id, finish from collection_items where user_id = :userId and card_id = any(:cardIds)")
                .param("userId", userId)
                .param("cardIds", cardIds.toArray(String[]::new))
                .query((rs, row) -> {
                    ownedCards.add(rs.getString("card_id"));
                    ownedPairs.add(pairKey(rs.getString("card_id"), rs.getString("finish")));
                    return null;
                })
                .list();
        List<Added> added = new ArrayList<>(grants.size());
        for (Grant grant : grants) {
            boolean newCard = ownedCards.add(grant.cardId());
            boolean newFinish = ownedPairs.add(pairKey(grant.cardId(), grant.finish().key()));
            jdbc.sql("""
                            insert into collection_items (user_id, card_id, finish, quantity, first_obtained_at, last_obtained_at)
                            values (:userId, :cardId, :finish, 1, :now, :now)
                            on conflict (user_id, card_id, finish)
                            do update set quantity = collection_items.quantity + 1, last_obtained_at = excluded.last_obtained_at
                            """)
                    .param("userId", userId)
                    .param("cardId", grant.cardId())
                    .param("finish", grant.finish().key())
                    .param("now", Timestamp.from(now))
                    .update();
            added.add(new Added(grant.cardId(), grant.finish(), newCard, newFinish));
        }
        return added;
    }

    @Transactional
    public RecycleResponse recycle(UUID userId, String cardId, CardFinish finish, int quantity) {
        Card card = catalogService.find(cardId).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Unknown card"));
        Optional<Integer> remaining = jdbc.sql("""
                        update collection_items set quantity = quantity - :quantity
                        where user_id = :userId and card_id = :cardId and finish = :finish and quantity - :quantity >= 1
                        returning quantity
                        """)
                .param("quantity", quantity)
                .param("userId", userId)
                .param("cardId", cardId)
                .param("finish", finish.key())
                .query(Integer.class)
                .optional();
        if (remaining.isEmpty()) {
            boolean owned = jdbc.sql("select 1 from collection_items where user_id = :userId and card_id = :cardId and finish = :finish")
                    .param("userId", userId)
                    .param("cardId", cardId)
                    .param("finish", finish.key())
                    .query(Integer.class)
                    .optional()
                    .isPresent();
            throw new ApiException(owned ? ErrorCode.NOT_ENOUGH_DUPLICATES : ErrorCode.CARD_NOT_OWNED);
        }
        int influence = EconomyRules.recycleValue(card.getRarity(), finish, quantity);
        walletService.addInfluence(userId, influence, WalletSource.RECYCLE);
        events.publishEvent(new CardsRecycledEvent(userId, cardId, quantity, influence, clock.instant()));
        return new RecycleResponse(cardId, finish, remaining.get(), influence, walletService.balance(userId).influence());
    }

    @Transactional
    public CraftResponse craft(UUID userId, String cardId) {
        Card card = catalogService.find(cardId)
                .filter(Card::isActive)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Unknown card"));
        boolean owned = jdbc.sql("select 1 from collection_items where user_id = :userId and card_id = :cardId limit 1")
                .param("userId", userId)
                .param("cardId", cardId)
                .query(Integer.class)
                .optional()
                .isPresent();
        if (owned) {
            throw new ApiException(ErrorCode.CARD_ALREADY_OWNED);
        }
        int cost = EconomyRules.CRAFT_COST.get(card.getRarity());
        walletService.spendInfluence(userId, cost, WalletSource.CRAFT);
        addAll(userId, List.of(new Grant(cardId, CardFinish.STANDARD)));
        events.publishEvent(new CardCraftedEvent(userId, cardId, cost, clock.instant()));
        return new CraftResponse(cardId, CardFinish.STANDARD, cost, walletService.balance(userId).influence());
    }

    private static String pairKey(String cardId, String finish) {
        return cardId + '|' + finish;
    }

    public record Grant(String cardId, CardFinish finish) {}

    public record Added(String cardId, CardFinish finish, boolean newCard, boolean newFinish) {}
}
