package com.mandat.api.pack;

import static com.mandat.api.support.GameTestSupport.as;
import static com.mandat.api.support.GameTestSupport.influence;
import static com.mandat.api.support.GameTestSupport.ledger;
import static com.mandat.api.support.GameTestSupport.newUser;
import static com.mandat.api.support.GameTestSupport.progressionInfluence;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.mandat.api.common.wallet.WalletSource;
import com.mandat.api.support.GameTestConfig;
import com.mandat.api.support.GameTestConfig.FailingPackListener;
import com.mandat.api.support.GameTestConfig.MutableClock;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
@Import(GameTestConfig.class)
class PackApiTest {

    static final String STANDARD = "s1-standard";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    MutableClock clock;

    @Autowired
    FailingPackListener failingListener;

    UUID user;

    @BeforeEach
    void setUp() {
        clock.set(GameTestConfig.START);
        user = newUser(jdbc);
    }

    @AfterEach
    void tearDown() {
        failingListener.enabled.set(false);
    }

    @Test
    void newPlayerHasTwoFreeBoostersAndOnlyTheStandardOneUnlocked() throws Exception {
        mockMvc.perform(get("/api/v1/packs").with(as(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.packs", hasSize(7)))
                .andExpect(jsonPath("$.packs[0].id").value(STANDARD))
                .andExpect(jsonPath("$.packs[0].unlocked").value(true))
                .andExpect(jsonPath("$.packs[1].unlocked").value(false))
                .andExpect(jsonPath("$.freePacks.available").value(2))
                .andExpect(jsonPath("$.freePacks.max").value(2))
                .andExpect(jsonPath("$.freePacks.nextAt").value(nullValue()))
                .andExpect(jsonPath("$.bonusPacks").value(0))
                .andExpect(jsonPath("$.pity.epicGuaranteedIn").value(10))
                .andExpect(jsonPath("$.pity.legendaryGuaranteedIn").value(40));
    }

    @Test
    void oddsPublishTheEngineConstants() throws Exception {
        mockMvc.perform(get("/api/v1/packs/" + STANDARD + "/odds").with(as(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slots[0].slots", hasSize(4)))
                .andExpect(jsonPath("$.slots[0].rarities[0].rarity").value("common"))
                .andExpect(jsonPath("$.slots[0].rarities[0].percent").value(65.0))
                .andExpect(jsonPath("$.slots[1].rarities[3].rarity").value("mythic"))
                .andExpect(jsonPath("$.slots[1].rarities[3].percent").value(1.0))
                .andExpect(jsonPath("$.finishes[0].finish").value("gold"))
                .andExpect(jsonPath("$.finishes[0].percent").value(0.3))
                .andExpect(jsonPath("$.finishes[1].finish").value("full_art"))
                .andExpect(jsonPath("$.finishes[1].guaranteedSlotOnly").value(true))
                .andExpect(jsonPath("$.pity.epicEveryPacks").value(10))
                .andExpect(jsonPath("$.continentFallback").value(false));
    }

    @Test
    void openingRequiresAnIdempotencyKey() throws Exception {
        mockMvc.perform(post("/api/v1/packs/" + STANDARD + "/open").with(as(user)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("idempotency_key_required"));
    }

    @Test
    void firstOpeningIsTheBalancedOnboardingBoosterAndIsStoredInTheCollection() throws Exception {
        open(STANDARD, "first")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstPack").value(true))
                .andExpect(jsonPath("$.cards", hasSize(5)))
                .andExpect(jsonPath("$.cards[0].rarity").value("common"))
                .andExpect(jsonPath("$.cards[4].slot").value(5))
                .andExpect(jsonPath("$.freePacks.available").value(1))
                .andExpect(jsonPath("$.pity.packsSinceEpic").value(0));

        List<String> continents = jdbc.sql("""
                        select c.continent from collection_items i join cards c on c.id = i.card_id
                        where i.user_id = :userId
                        """)
                .param("userId", user).query(String.class).list();
        assertThat(continents).hasSize(5).doesNotHaveDuplicates();
        assertThat(jdbc.sql("select count(*) from collection_items i join cards c on c.id = i.card_id where i.user_id = :u and c.sensitive")
                .param("u", user).query(Integer.class).single()).isZero();

        open(STANDARD, "second")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstPack").value(false));
    }

    @Test
    void replayingAKeyReturnsTheSameResultWithoutOpeningAnotherBooster() throws Exception {
        String first = body(open(STANDARD, "replay-key").andExpect(status().isOk()));
        String replay = body(open(STANDARD, "replay-key").andExpect(status().isOk()));
        assertThat(replay).isEqualTo(first);
        assertThat(openings()).isEqualTo(1);
        assertThat(packsOpened()).isEqualTo(1);

        open("s1-europe", "replay-key")
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("idempotency_key_reused"));
    }

    @Test
    void concurrentRequestsWithTheSameKeyOpenOneBooster() throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        Callable<String> call = () -> {
            start.await();
            return body(open(STANDARD, "concurrent").andExpect(status().isOk()));
        };
        try (ExecutorService executor = Executors.newFixedThreadPool(4)) {
            List<Future<String>> futures = List.of(
                    executor.submit(call), executor.submit(call), executor.submit(call), executor.submit(call));
            start.countDown();
            String expectedId = JsonPath.read(futures.getFirst().get(), "$.openingId");
            for (Future<String> future : futures) {
                assertThat((String) JsonPath.read(future.get(), "$.openingId")).isEqualTo(expectedId);
            }
        }
        assertThat(openings()).isEqualTo(1);
        assertThat(packsOpened()).isEqualTo(1);
        assertThat(copies()).isEqualTo(5);
    }

    @Test
    void stockRunsOutThenBonusBoostersThenTheTimerRefills() throws Exception {
        open(STANDARD, "a").andExpect(status().isOk());
        open(STANDARD, "b").andExpect(status().isOk()).andExpect(jsonPath("$.freePacks.available").value(0));
        // Progression rewards (level-ups) may have granted bonus boosters: start from none.
        jdbc.sql("update users set bonus_packs = 0 where id = :id").param("id", user).update();
        open(STANDARD, "c")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("no_pack_available"));

        jdbc.sql("update users set bonus_packs = 1 where id = :id").param("id", user).update();
        open(STANDARD, "d").andExpect(status().isOk());
        assertThat(ledger(jdbc, user, "bonus_packs", WalletSource.PACK_OPEN)).isEqualTo(-1);

        clock.advance(Duration.ofHours(12));
        mockMvc.perform(get("/api/v1/packs").with(as(user)))
                .andExpect(jsonPath("$.freePacks.available").value(1))
                .andExpect(jsonPath("$.freePacks.nextAt").value("2026-03-02T08:00:00Z"));
        open(STANDARD, "e").andExpect(status().isOk());
    }

    @Test
    void lockedThemedBoosterCannotBeOpened() throws Exception {
        open("s1-oceania", "locked")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("pack_locked"));
        open("s1-unknown", "unknown").andExpect(status().isNotFound());
        assertThat(packsOpened()).isZero();
    }

    @Test
    void aFailureDuringTheOpeningRollsEverythingBack() throws Exception {
        failingListener.enabled.set(true);
        open(STANDARD, "boom").andExpect(status().isInternalServerError());
        failingListener.enabled.set(false);

        assertThat(openings()).isZero();
        assertThat(packsOpened()).isZero();
        assertThat(copies()).isZero();
        assertThat(influence(jdbc, user)).isZero();
        mockMvc.perform(get("/api/v1/packs").with(as(user))).andExpect(jsonPath("$.freePacks.available").value(2));

        // The same key works once the failure is gone: nothing was stored for it.
        open(STANDARD, "boom").andExpect(status().isOk());
    }

    @Test
    void duplicatesGrantInfluence() throws Exception {
        // Own every card already: all drawn cards are duplicates.
        jdbc.sql("""
                        insert into collection_items (user_id, card_id, finish, quantity, first_obtained_at, last_obtained_at)
                        select :userId, id, 'standard', 1, now(), now() from cards
                        """)
                .param("userId", user).update();
        jdbc.sql("insert into pack_states (user_id, free_packs_anchor, packs_opened) values (:id, '2026-01-01T00:00:00Z', 3)")
                .param("id", user).update();
        String response = body(open(STANDARD, "dupes").andExpect(status().isOk()));
        int gained = JsonPath.read(response, "$.influenceGained");
        List<Boolean> isNew = JsonPath.read(response, "$.cards[*].isNew");
        assertThat(isNew).containsOnly(false);
        assertThat(gained).isPositive();
        assertThat(ledger(jdbc, user, "influence", WalletSource.PACK_DUPLICATES)).isEqualTo(gained);
        // Progression may add level/achievement rewards on top of the duplicates bonus.
        assertThat(influence(jdbc, user)).isEqualTo(gained + progressionInfluence(jdbc, user));
    }

    @Test
    void catalogSupportsConditionalRequests() throws Exception {
        String etag = mockMvc.perform(get("/api/v1/cards").param("season", "1").with(as(user)))
                .andExpect(status().isOk())
                .andExpect(header().exists("ETag"))
                .andExpect(jsonPath("$.cards", hasSize(72)))
                .andExpect(jsonPath("$.cards[0].name.fr").value("Figure 1"))
                .andReturn().getResponse().getHeader("ETag");
        mockMvc.perform(get("/api/v1/cards").param("season", "1").header("If-None-Match", etag).with(as(user)))
                .andExpect(status().isNotModified());
        mockMvc.perform(get("/api/v1/cards").param("season", "9").with(as(user))).andExpect(status().isNotFound());
    }

    private ResultActions open(String packId, String key) throws Exception {
        return mockMvc.perform(post("/api/v1/packs/" + packId + "/open").header("Idempotency-Key", key).with(as(user)));
    }

    private static String body(ResultActions result) throws Exception {
        return result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private int openings() {
        return jdbc.sql("select count(*) from pack_openings where user_id = :id").param("id", user).query(Integer.class).single();
    }

    private int packsOpened() {
        return jdbc.sql("select coalesce(max(packs_opened), 0) from pack_states where user_id = :id")
                .param("id", user).query(Integer.class).single();
    }

    private int copies() {
        return jdbc.sql("select coalesce(sum(quantity), 0) from collection_items where user_id = :id")
                .param("id", user).query(Integer.class).single();
    }
}
