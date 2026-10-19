package com.mandat.api.collection;

import static com.mandat.api.support.GameTestSupport.as;
import static com.mandat.api.support.GameTestSupport.influence;
import static com.mandat.api.support.GameTestSupport.ledger;
import static com.mandat.api.support.GameTestSupport.newUser;
import static com.mandat.api.support.GameTestSupport.progressionInfluence;
import static com.mandat.api.support.GameTestSupport.setInfluence;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mandat.api.common.wallet.WalletSource;
import com.mandat.api.support.GameTestConfig;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
@Import(GameTestConfig.class)
class CollectionApiTest {

    /** Fixture (africa block): t-001 common, t-005 rare, t-012 mythic. */
    static final String RARE = "t-005";
    static final String COMMON = "t-001";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcClient jdbc;

    UUID user;

    @BeforeEach
    void setUp() {
        user = newUser(jdbc);
    }

    @Test
    void collectionListsEveryCardAndFinish() throws Exception {
        own(RARE, "standard", 3);
        own(RARE, "holo", 1);
        own(COMMON, "standard", 1);
        mockMvc.perform(get("/api/v1/collection").with(as(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(3)))
                .andExpect(jsonPath("$.distinctCards").value(2))
                .andExpect(jsonPath("$.totalCopies").value(5));
    }

    @Test
    void recyclingKeepsOneCopyAndGrantsInfluenceByRarityAndFinish() throws Exception {
        own(RARE, "standard", 3);
        recycle(RARE, "standard", 2)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.remainingQuantity").value(1))
                .andExpect(jsonPath("$.influenceGained").value(2 * EconomyRules.RECYCLE_VALUE.get(com.mandat.api.card.Rarity.RARE)));
        assertThat(influence(jdbc, user)).isEqualTo(2 * EconomyRules.RECYCLE_VALUE.get(com.mandat.api.card.Rarity.RARE));

        recycle(RARE, "standard", 1)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("not_enough_duplicates"));
        recycle(RARE, "gold", 1)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("card_not_owned"));
    }

    @Test
    void holoCopiesAreWorthMore() throws Exception {
        own(RARE, "holo", 2);
        int holo = EconomyRules.RECYCLE_VALUE.get(com.mandat.api.card.Rarity.RARE)
                * EconomyRules.FINISH_MULTIPLIER.get(com.mandat.api.card.CardFinish.HOLO);
        recycle(RARE, "holo", 1).andExpect(status().isOk()).andExpect(jsonPath("$.influenceGained").value(holo));
    }

    @Test
    void economyEndpointExposesTheServerRules() throws Exception {
        mockMvc.perform(get("/api/v1/economy").with(as(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rarities.length()").value(6))
                .andExpect(jsonPath("$.rarities[0].rarity").value("common"))
                .andExpect(jsonPath("$.rarities[0].craftCost").value(EconomyRules.CRAFT_COST.get(com.mandat.api.card.Rarity.COMMON)))
                .andExpect(jsonPath("$.rarities[2].rarity").value("rare"))
                .andExpect(jsonPath("$.rarities[2].recycleValue").value(EconomyRules.RECYCLE_VALUE.get(com.mandat.api.card.Rarity.RARE)))
                .andExpect(jsonPath("$.rarities[5].duplicateBonus").value(EconomyRules.DUPLICATE_BONUS.get(com.mandat.api.card.Rarity.MYTHIC)))
                .andExpect(jsonPath("$.finishes[?(@.finish == 'gold')].multiplier").value(
                        org.hamcrest.Matchers.contains(EconomyRules.FINISH_MULTIPLIER.get(com.mandat.api.card.CardFinish.GOLD))))
                .andExpect(jsonPath("$.craftFinish").value("standard"))
                .andExpect(jsonPath("$.keptCopiesWhenRecycling").value(1));
    }

    @Test
    void tenDuplicatesOfARarityCraftOneCardOfThatRarity() {
        // docs/TCG_REVIEW.md §3.4: a flat, legible ratio, finish multipliers on recycling only.
        for (com.mandat.api.card.Rarity rarity : com.mandat.api.card.Rarity.values()) {
            int recycle = EconomyRules.RECYCLE_VALUE.get(rarity);
            assertThat(EconomyRules.CRAFT_COST.get(rarity)).as(rarity.key()).isEqualTo(10 * recycle);
            assertThat(EconomyRules.DUPLICATE_BONUS.get(rarity)).as(rarity.key()).isLessThan(recycle);
            assertThat(EconomyRules.duplicateBonus(rarity, com.mandat.api.card.CardFinish.GOLD))
                    .isEqualTo(EconomyRules.DUPLICATE_BONUS.get(rarity));
        }
    }

    @Test
    void craftAllowanceIsOneCardEveryTwoDaysWithAStockOfThree() throws Exception {
        setInfluence(jdbc, user, 100_000);
        mockMvc.perform(get("/api/v1/limits").with(as(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.crafts.available").value(1))
                .andExpect(jsonPath("$.crafts.max").value(3))
                .andExpect(jsonPath("$.crafts.intervalHours").value(48))
                .andExpect(jsonPath("$.quizRewards.remaining").value(3))
                .andExpect(jsonPath("$.duelWinRewards.remaining").value(5));
        craft(RARE).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/limits").with(as(user)))
                .andExpect(jsonPath("$.crafts.available").value(0))
                .andExpect(jsonPath("$.crafts.nextAt").isNotEmpty());
        craft(COMMON).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("craft_limit_reached"));
        // 10 days later the stock is full (3), not 5: time at full stock is not banked.
        jdbc.sql("update craft_allowances set anchor = anchor - interval '10 days' where user_id = :id")
                .param("id", user).update();
        mockMvc.perform(get("/api/v1/limits").with(as(user)))
                .andExpect(jsonPath("$.crafts.available").value(3))
                .andExpect(jsonPath("$.crafts.nextAt").doesNotExist());
        craft(COMMON).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/limits").with(as(user))).andExpect(jsonPath("$.crafts.available").value(2));
    }

    private void refillCraftAllowance() {
        jdbc.sql("update craft_allowances set anchor = anchor - interval '48 hours' where user_id = :id")
                .param("id", user).update();
    }

    @Test
    void recycleRequestIsValidated() throws Exception {
        mockMvc.perform(post("/api/v1/collection/" + RARE + "/recycle").with(as(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"finish\":\"standard\",\"quantity\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("validation_failed"));
    }

    @Test
    void craftingAMissingCardCostsInfluence() throws Exception {
        int rareCost = EconomyRules.CRAFT_COST.get(com.mandat.api.card.Rarity.RARE);
        int commonCost = EconomyRules.CRAFT_COST.get(com.mandat.api.card.Rarity.COMMON);
        setInfluence(jdbc, user, rareCost + 50);
        craft(RARE).andExpect(status().isOk())
                .andExpect(jsonPath("$.finish").value("standard"))
                .andExpect(jsonPath("$.influenceSpent").value(rareCost));
        // Crafting grants XP: progression rewards may land on top of the remaining 50.
        assertThat(influence(jdbc, user)).isEqualTo(50 + progressionInfluence(jdbc, user));
        craft(RARE).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("card_already_owned"));
        setInfluence(jdbc, user, commonCost);
        // The starting allowance (1 craft) is used: the next craft waits for the allowance timer.
        craft(COMMON).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("craft_limit_reached"));
        assertThat(influence(jdbc, user)).isEqualTo(commonCost);
        refillCraftAllowance();
        craft(COMMON).andExpect(status().isOk());
        setInfluence(jdbc, user, 10);
        craft("t-012").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("insufficient_influence"));
        craft("nope").andExpect(status().isNotFound());
        assertThat(ledger(jdbc, user, "influence", WalletSource.CRAFT)).isEqualTo(-(rareCost + commonCost));
        assertThat(influence(jdbc, user)).isEqualTo(10);
    }

    private void own(String cardId, String finish, int quantity) {
        jdbc.sql("""
                        insert into collection_items (user_id, card_id, finish, quantity, first_obtained_at, last_obtained_at)
                        values (:userId, :cardId, :finish, :quantity, now(), now())
                        """)
                .param("userId", user).param("cardId", cardId).param("finish", finish).param("quantity", quantity)
                .update();
    }

    private ResultActions recycle(String cardId, String finish, int quantity) throws Exception {
        return mockMvc.perform(post("/api/v1/collection/" + cardId + "/recycle").with(as(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"finish\":\"" + finish + "\",\"quantity\":" + quantity + "}"));
    }

    private ResultActions craft(String cardId) throws Exception {
        return mockMvc.perform(post("/api/v1/collection/" + cardId + "/craft").with(as(user)));
    }
}
