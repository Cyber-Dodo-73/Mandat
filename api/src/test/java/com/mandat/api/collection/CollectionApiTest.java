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
        assertThat(influence(jdbc, user)).isEqualTo(50);

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
        recycle(RARE, "holo", 1).andExpect(status().isOk()).andExpect(jsonPath("$.influenceGained").value(50));
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
        setInfluence(jdbc, user, 250);
        craft(RARE).andExpect(status().isOk())
                .andExpect(jsonPath("$.finish").value("standard"))
                .andExpect(jsonPath("$.influenceSpent").value(200));
        // Crafting grants XP: progression rewards may land on top of the remaining 50.
        assertThat(influence(jdbc, user)).isEqualTo(50 + progressionInfluence(jdbc, user));
        craft(RARE).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("card_already_owned"));
        craft(COMMON).andExpect(status().isOk());
        setInfluence(jdbc, user, 10);
        craft("t-012").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("insufficient_influence"));
        craft("nope").andExpect(status().isNotFound());
        assertThat(ledger(jdbc, user, "influence", WalletSource.CRAFT)).isEqualTo(-240);
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
