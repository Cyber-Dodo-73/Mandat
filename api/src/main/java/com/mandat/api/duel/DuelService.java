package com.mandat.api.duel;

import com.mandat.api.card.Card;
import com.mandat.api.card.CardCatalogService;
import com.mandat.api.card.CatalogProperties;
import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.common.events.DuelFinishedEvent;
import com.mandat.api.common.wallet.WalletService;
import com.mandat.api.common.wallet.WalletSource;
import com.mandat.api.duel.dto.DuelDtos.CreateDuelRequest;
import com.mandat.api.duel.dto.DuelDtos.DuelResponse;
import com.mandat.api.duel.dto.DuelDtos.DuelRewardDto;
import com.mandat.api.duel.engine.Domain;
import com.mandat.api.duel.engine.DuelAi;
import com.mandat.api.duel.engine.DuelAi.Difficulty;
import com.mandat.api.duel.engine.DuelEngine;
import com.mandat.api.duel.engine.DuelEngine.RoundOutcome;
import com.mandat.api.duel.engine.DuelEngine.Winner;
import com.mandat.api.economy.DailyRewardLimits;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.random.RandomGenerator;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * Duels against the AI. Everything is decided here: card ownership, the AI team, the round domains,
 * the AI's plays and the resolution. The client only picks one of its remaining cards per round.
 */
@Service
public class DuelService {

    private static final Domain[] DOMAINS = Domain.values();

    private final JdbcClient jdbc;
    private final CardCatalogService catalog;
    private final CatalogProperties catalogProperties;
    private final WalletService wallet;
    private final ApplicationEventPublisher events;
    private final RandomGenerator random;
    private final JsonMapper jsonMapper;
    private final Clock clock;
    private final DailyRewardLimits dailyLimits;

    public DuelService(
            JdbcClient jdbc,
            CardCatalogService catalog,
            CatalogProperties catalogProperties,
            WalletService wallet,
            ApplicationEventPublisher events,
            RandomGenerator random,
            JsonMapper jsonMapper,
            Clock clock,
            DailyRewardLimits dailyLimits) {
        this.jdbc = jdbc;
        this.catalog = catalog;
        this.catalogProperties = catalogProperties;
        this.wallet = wallet;
        this.events = events;
        this.random = random;
        this.jsonMapper = jsonMapper;
        this.clock = clock;
        this.dailyLimits = dailyLimits;
    }

    @Transactional
    public DuelResponse create(UUID userId, CreateDuelRequest request) {
        List<String> cardIds = request.cardIds();
        if (new HashSet<>(cardIds).size() != DuelRules.ROUNDS) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Pick 3 different cards");
        }
        int owned = jdbc.sql("""
                        select count(distinct card_id) from collection_items
                        where user_id = :userId and card_id = any(:ids)
                        """)
                .param("userId", userId)
                .param("ids", cardIds.toArray(String[]::new))
                .query(Integer.class)
                .single();
        if (owned != DuelRules.ROUNDS) {
            throw new ApiException(ErrorCode.CARD_NOT_OWNED, "All 3 cards must be in your collection");
        }
        List<Card> playerTeam = cardIds.stream().map(this::card).toList();
        List<Card> aiTeam = DuelAi.pickTeam(request.difficulty(), playerTeam,
                catalog.activeCards(catalogProperties.season()), random);

        // One active duel at a time: starting a new one abandons the previous.
        jdbc.sql("update duels set status = 'abandoned' where user_id = :userId and status = 'active'")
                .param("userId", userId)
                .update();
        UUID id = UUID.randomUUID();
        Instant now = clock.instant();
        jdbc.sql("""
                        insert into duels (id, user_id, difficulty, status, player_cards, ai_cards, next_domain, created_at)
                        values (:id, :userId, :difficulty, 'active', :playerCards, :aiCards, :nextDomain, :now)
                        """)
                .param("id", id)
                .param("userId", userId)
                .param("difficulty", request.difficulty().key())
                .param("playerCards", cardIds.toArray(String[]::new))
                .param("aiCards", aiTeam.stream().map(Card::getId).toArray(String[]::new))
                .param("nextDomain", drawDomain().key())
                .param("now", Timestamp.from(now))
                .update();
        return load(userId, id, null);
    }

    @Transactional(readOnly = true)
    public DuelResponse get(UUID userId, UUID duelId) {
        return load(userId, duelId, null);
    }

    @Transactional
    public DuelResponse playRound(UUID userId, UUID duelId, String cardId) {
        DuelRow duel = lock(userId, duelId);
        if (!"active".equals(duel.status())) {
            throw new ApiException(ErrorCode.DUEL_FINISHED, "This duel is over");
        }
        List<RoundOutcome> played = rounds(duelId);
        List<String> playerLeft = remaining(duel.playerCards(), played, true);
        if (!playerLeft.contains(cardId)) {
            throw new ApiException(ErrorCode.DUEL_CARD_UNAVAILABLE, "This card is not in your hand for this duel");
        }
        List<String> aiLeft = remaining(duel.aiCards(), played, false);
        int round = played.size() + 1;
        Domain domain = duel.nextDomain();

        Card playerCard = card(cardId);
        Card aiCard = DuelAi.chooseCard(duel.difficulty(), aiLeft.stream().map(this::card).toList(),
                playerLeft.stream().map(this::card).toList(), domain, round, duel.playerScore(), duel.aiScore(), random);
        RoundOutcome outcome = DuelEngine.resolve(playerCard, aiCard, domain, round, duel.playerScore(), duel.aiScore());

        Instant now = clock.instant();
        jdbc.sql("""
                        insert into duel_rounds (duel_id, round_number, domain, player_card, ai_card, outcome, played_at)
                        values (:duelId, :round, :domain, :playerCard, :aiCard, cast(:outcome as jsonb), :now)
                        """)
                .param("duelId", duelId)
                .param("round", round)
                .param("domain", domain.key())
                .param("playerCard", playerCard.getId())
                .param("aiCard", aiCard.getId())
                .param("outcome", jsonMapper.writeValueAsString(outcome))
                .param("now", Timestamp.from(now))
                .update();

        int playerScore = duel.playerScore() + (outcome.winner() == Winner.PLAYER ? 1 : 0);
        int aiScore = duel.aiScore() + (outcome.winner() == Winner.AI ? 1 : 0);
        boolean finished = round == DuelRules.ROUNDS
                || playerScore == DuelRules.WINS_NEEDED
                || aiScore == DuelRules.WINS_NEEDED;
        Winner winner = !finished ? null
                : playerScore > aiScore ? Winner.PLAYER
                : aiScore > playerScore ? Winner.AI
                : Winner.DRAW;
        jdbc.sql("""
                        update duels set player_score = :playerScore, ai_score = :aiScore, rounds_played = :round,
                            next_domain = :nextDomain, status = :status, winner = :winner, finished_at = :finishedAt
                        where id = :id
                        """)
                .param("playerScore", playerScore)
                .param("aiScore", aiScore)
                .param("round", round)
                .param("nextDomain", finished ? null : drawDomain().key())
                .param("status", finished ? "finished" : "active")
                .param("winner", winner == null ? null : winner.key())
                .param("finishedAt", finished ? Timestamp.from(now) : null)
                .param("id", duelId)
                .update();

        DuelRewardDto reward = null;
        if (finished) {
            // Daily cap (RewardLimits): once 5 wins were rewarded today, duels still play but grant no Influence.
            boolean capped = !dailyLimits.duelRewardAvailable(userId, now);
            int influence = capped ? 0 : DuelRules.influence(duel.difficulty(), winner);
            if (influence > 0) {
                wallet.addInfluence(userId, influence, WalletSource.DUEL_REWARD);
            }
            jdbc.sql("""
                            update duels set rewarded = :rewarded, reward_influence = :influence, reward_capped = :capped
                            where id = :id
                            """)
                    .param("rewarded", !capped)
                    .param("influence", influence)
                    .param("capped", capped)
                    .param("id", duelId)
                    .update();
            events.publishEvent(new DuelFinishedEvent(userId, duelId, winner == Winner.PLAYER, duel.difficulty().key(), now));
            reward = new DuelRewardDto(influence, capped);
        }
        return load(userId, duelId, reward);
    }

    private Domain drawDomain() {
        return DOMAINS[random.nextInt(DOMAINS.length)];
    }

    private Card card(String id) {
        return catalog.find(id).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Unknown card " + id));
    }

    private static List<String> remaining(List<String> team, List<RoundOutcome> played, boolean player) {
        Set<String> used = new HashSet<>();
        played.forEach(r -> used.add(player ? r.playerCardId() : r.aiCardId()));
        return team.stream().filter(id -> !used.contains(id)).toList();
    }

    private DuelResponse load(UUID userId, UUID duelId, DuelRewardDto reward) {
        DuelRow duel = jdbc.sql("select * from duels where id = :id and user_id = :userId")
                .param("id", duelId)
                .param("userId", userId)
                .query(DuelService::row)
                .optional()
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Unknown duel"));
        List<RoundOutcome> played = rounds(duelId);
        DuelRewardDto finalReward = reward;
        if (finalReward == null && "finished".equals(duel.status()) && duel.winner() != null) {
            finalReward = duel.rewardInfluence() != null
                    ? new DuelRewardDto(duel.rewardInfluence(), duel.rewardCapped())
                    : new DuelRewardDto(DuelRules.influence(duel.difficulty(), duel.winner()), false);
        }
        return new DuelResponse(
                duel.id(), duel.difficulty(), duel.status(), duel.playerCards(), duel.aiCards(),
                remaining(duel.playerCards(), played, true), remaining(duel.aiCards(), played, false),
                duel.playerScore(), duel.aiScore(), played.size(),
                "active".equals(duel.status()) ? duel.nextDomain() : null,
                played, duel.winner(), finalReward, duel.createdAt());
    }

    private DuelRow lock(UUID userId, UUID duelId) {
        return jdbc.sql("select * from duels where id = :id and user_id = :userId for update")
                .param("id", duelId)
                .param("userId", userId)
                .query(DuelService::row)
                .optional()
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Unknown duel"));
    }

    private List<RoundOutcome> rounds(UUID duelId) {
        return jdbc.sql("select outcome::text from duel_rounds where duel_id = :id order by round_number")
                .param("id", duelId)
                .query(String.class)
                .list()
                .stream()
                .map(json -> jsonMapper.readValue(json, RoundOutcome.class))
                .toList();
    }

    private static DuelRow row(ResultSet rs, int rowNum) throws SQLException {
        String nextDomain = rs.getString("next_domain");
        String winner = rs.getString("winner");
        return new DuelRow(
                rs.getObject("id", UUID.class),
                Difficulty.fromKey(rs.getString("difficulty")),
                rs.getString("status"),
                strings(rs.getArray("player_cards")),
                strings(rs.getArray("ai_cards")),
                rs.getInt("player_score"),
                rs.getInt("ai_score"),
                nextDomain == null ? null : Domain.fromKey(nextDomain),
                winner == null ? null : Winner.fromKey(winner),
                rs.getTimestamp("created_at").toInstant(),
                rewardInfluence(rs),
                rs.getBoolean("reward_capped"));
    }

    private static Integer rewardInfluence(ResultSet rs) throws SQLException {
        int value = rs.getInt("reward_influence");
        return rs.wasNull() ? null : value;
    }

    private static List<String> strings(Array array) throws SQLException {
        return new ArrayList<>(Arrays.asList((String[]) array.getArray()));
    }

    private record DuelRow(
            UUID id,
            Difficulty difficulty,
            String status,
            List<String> playerCards,
            List<String> aiCards,
            int playerScore,
            int aiScore,
            Domain nextDomain,
            Winner winner,
            Instant createdAt,
            Integer rewardInfluence,
            boolean rewardCapped) {}
}
