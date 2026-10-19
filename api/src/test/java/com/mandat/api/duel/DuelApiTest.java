package com.mandat.api.duel;

import static com.mandat.api.support.GameTestSupport.as;
import static com.mandat.api.support.GameTestSupport.ledger;
import static com.mandat.api.support.GameTestSupport.newUser;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.mandat.api.card.Card;
import com.mandat.api.card.CardCatalogService;
import com.mandat.api.common.wallet.WalletSource;
import com.mandat.api.duel.engine.DuelAi.Difficulty;
import com.mandat.api.duel.engine.DuelEngine;
import com.mandat.api.duel.engine.DuelEngine.RoundOutcome;
import com.mandat.api.duel.engine.DuelEngine.Winner;
import com.mandat.api.duel.engine.Domain;
import com.mandat.api.support.GameTestConfig;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.random.RandomGenerator;
import java.util.random.RandomGeneratorFactory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
@Import({GameTestConfig.class, DuelApiTest.SeededRandom.class})
class DuelApiTest {

    static final List<String> TEAM = List.of("t-001", "t-014", "t-027");

    /** Deterministic draws: domains, AI team and easy AI plays depend only on this seed. */
    @TestConfiguration(proxyBeanMethods = false)
    static class SeededRandom {
        @Bean
        @Primary
        RandomGenerator seededRandom() {
            return RandomGeneratorFactory.of("L64X128MixRandom").create(2026);
        }
    }

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    JsonMapper jsonMapper;

    @Autowired
    CardCatalogService catalog;

    @Test
    void cardsMustBeOwnedAndDistinct() throws Exception {
        UUID user = newUser(jdbc);
        create(user, TEAM, "normal").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("card_not_owned"));
        give(user, TEAM);
        create(user, List.of("t-001", "t-001", "t-014"), "normal").andExpect(status().isBadRequest());
        create(user, List.of("t-001", "t-014"), "normal").andExpect(status().isBadRequest());
    }

    @Test
    void fullDuelIsResolvedServerSideAndRewarded() throws Exception {
        UUID user = newUser(jdbc);
        give(user, TEAM);
        String created = create(user, TEAM, "normal").andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("active"))
                .andExpect(jsonPath("$.aiCards", hasSize(3)))
                .andExpect(jsonPath("$.nextDomain").isString())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        UUID duel = UUID.fromString(JsonPath.read(created, "$.id"));
        List<String> aiCards = JsonPath.read(created, "$.aiCards");
        assertThat(aiCards).doesNotContainAnyElementsOf(TEAM).doesNotHaveDuplicates();

        // A card outside the player's hand is refused.
        round(user, duel, aiCards.get(0)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("duel_card_unavailable"));

        String state = created;
        int played = 0;
        while ("active".equals(JsonPath.read(state, "$.status"))) {
            String domain = JsonPath.read(state, "$.nextDomain");
            String card = TEAM.get(played);
            state = round(user, duel, card).andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
            played++;
            RoundOutcome outcome = jsonMapper.readValue(
                    jsonMapper.writeValueAsString(JsonPath.read(state, "$.rounds[" + (played - 1) + "]")), RoundOutcome.class);
            assertThat(outcome.domain().key()).isEqualTo(domain);
            assertThat(outcome.playerCardId()).isEqualTo(card);
            // The stored resolution matches the engine on catalog data (no client input involved).
            Card playerCard = catalog.find(card).orElseThrow();
            Card aiCard = catalog.find(outcome.aiCardId()).orElseThrow();
            int playerWins = (Integer) JsonPath.read(state, "$.playerScore") - (outcome.winner() == Winner.PLAYER ? 1 : 0);
            int aiWins = (Integer) JsonPath.read(state, "$.aiScore") - (outcome.winner() == Winner.AI ? 1 : 0);
            assertThat(DuelEngine.resolve(playerCard, aiCard, Domain.fromKey(domain), played, playerWins, aiWins))
                    .isEqualTo(outcome);
            // A played card can't be reused.
            if ("active".equals(JsonPath.read(state, "$.status"))) {
                round(user, duel, card).andExpect(status().isConflict());
            }
        }
        assertThat(played).isBetween(2, 3);
        String winner = JsonPath.read(state, "$.winner");
        int reward = JsonPath.read(state, "$.reward.influence");
        assertThat(reward).isEqualTo(DuelRules.influence(Difficulty.NORMAL, Winner.valueOf(winner.toUpperCase())));
        assertThat(ledger(jdbc, user, "influence", WalletSource.DUEL_REWARD)).isEqualTo(reward);
        Integer duelsPlayed = jdbc.sql("select duels_played from player_stats where user_id = :id")
                .param("id", user).query(Integer.class).single();
        assertThat(duelsPlayed).isEqualTo(1);

        round(user, duel, TEAM.get(2)).andExpect(status().isConflict());
        mockMvc.perform(get("/api/v1/duels/{id}", duel).with(as(user))).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("finished"))
                .andExpect(jsonPath("$.nextDomain").value(nullValue()));
    }

    @Test
    void duelInfluenceStopsAfterTheDailyCapOfRewardedWins() throws Exception {
        UUID user = newUser(jdbc);
        give(user, TEAM);
        String state = create(user, TEAM, "normal").andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        UUID duel = UUID.fromString(JsonPath.read(state, "$.id"));
        // Five wins already rewarded today (same server day as this duel).
        for (int i = 0; i < com.mandat.api.economy.RewardLimits.DUEL_WIN_REWARDS_PER_DAY; i++) {
            jdbc.sql("""
                            insert into duels (id, user_id, difficulty, status, player_cards, ai_cards, winner,
                                created_at, finished_at, rewarded, reward_influence)
                            select :id, user_id, 'normal', 'finished', player_cards, ai_cards, 'player',
                                created_at, created_at, true, 6
                            from duels where id = :duel
                            """)
                    .param("id", UUID.randomUUID()).param("duel", duel).update();
        }
        int played = 0;
        while ("active".equals(JsonPath.read(state, "$.status"))) {
            state = round(user, duel, TEAM.get(played++)).andExpect(status().isOk())
                    .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        }
        assertThat((Integer) JsonPath.read(state, "$.reward.influence")).isZero();
        assertThat((Boolean) JsonPath.read(state, "$.reward.capped")).isTrue();
        assertThat(ledger(jdbc, user, "influence", WalletSource.DUEL_REWARD)).isZero();
        // The stored reward is what a later read returns.
        mockMvc.perform(get("/api/v1/duels/{id}", duel).with(as(user)))
                .andExpect(jsonPath("$.reward.influence").value(0))
                .andExpect(jsonPath("$.reward.capped").value(true));
    }

    @Test
    void startingANewDuelAbandonsThePreviousOne() throws Exception {
        UUID user = newUser(jdbc);
        give(user, TEAM);
        UUID first = UUID.fromString(JsonPath.read(create(user, TEAM, "easy")
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8), "$.id"));
        create(user, TEAM, "hard").andExpect(status().isCreated());
        round(user, first, TEAM.get(0)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("duel_finished"));
    }

    @Test
    void duelsArePrivate() throws Exception {
        UUID owner = newUser(jdbc);
        UUID other = newUser(jdbc);
        give(owner, TEAM);
        UUID duel = UUID.fromString(JsonPath.read(create(owner, TEAM, "normal")
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8), "$.id"));
        round(other, duel, TEAM.get(0)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/duels/{id}", duel).with(as(other))).andExpect(status().isNotFound());
    }

    @Test
    void catalogExposesAbilityEffects() throws Exception {
        UUID user = newUser(jdbc);
        mockMvc.perform(get("/api/v1/cards").param("season", "1").with(as(user))).andExpect(status().isOk())
                .andExpect(jsonPath("$.cards[0].ability.effect.type").value("bonus"))
                .andExpect(jsonPath("$.cards[0].ability.effect.condition.kind").value("opponentContinent"))
                .andExpect(jsonPath("$.cards[0].ability.effect.condition.value").value("same"))
                .andExpect(jsonPath("$.cards[4].ability.effect.condition.value").value("3"))
                .andExpect(jsonPath("$.cards[7].ability.effect.type").value("tieBreaker"));
    }

    private void give(UUID user, List<String> cardIds) {
        for (String cardId : cardIds) {
            jdbc.sql("""
                            insert into collection_items (user_id, card_id, finish, quantity, first_obtained_at, last_obtained_at)
                            values (:user, :card, 'standard', 1, :now, :now)
                            """)
                    .param("user", user).param("card", cardId)
                    .param("now", Timestamp.from(GameTestConfig.START))
                    .update();
        }
    }

    private ResultActions create(UUID user, List<String> cardIds, String difficulty) throws Exception {
        String body = jsonMapper.writeValueAsString(Map.of("cardIds", cardIds, "difficulty", difficulty));
        return mockMvc.perform(post("/api/v1/duels").with(as(user)).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions round(UUID user, UUID duel, String cardId) throws Exception {
        return mockMvc.perform(post("/api/v1/duels/{id}/rounds", duel).with(as(user))
                .contentType(MediaType.APPLICATION_JSON).content(jsonMapper.writeValueAsString(Map.of("cardId", cardId))));
    }
}
