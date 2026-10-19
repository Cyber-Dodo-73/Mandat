package com.mandat.api.integration;

import static com.mandat.api.support.GameTestSupport.as;
import static com.mandat.api.support.GameTestSupport.newUser;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.mandat.api.support.GameTestConfig;
import com.mandat.api.support.GameTestConfig.MutableClock;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;

/** Opening a real pack drives progression through the catalog and collection providers. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(GameTestConfig.class)
class CrossDomainIntegrationTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    MutableClock clock;

    UUID user;

    @BeforeEach
    void setUp() {
        clock.set(GameTestConfig.START);
        user = newUser(jdbc);
    }

    @Test
    void openingAPackAdvancesCollectionContinentAndRarityAchievements() throws Exception {
        String opened = mockMvc.perform(post("/api/v1/packs/s1-standard/open").header("Idempotency-Key", "x1").with(as(user)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        List<String> cardIds = JsonPath.read(opened, "$.cards[*].cardId");
        long distinct = cardIds.stream().distinct().count();
        String firstContinent = jdbc.sql("select continent from cards where id = :id").param("id", cardIds.getFirst())
                .query(String.class).single();

        String achievements = mockMvc.perform(get("/api/v1/achievements").with(as(user)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

        List<Integer> collection = JsonPath.read(achievements, "$.achievements[?(@.metric == 'DISTINCT_CARDS')].progress");
        assertThat(collection).isNotEmpty().allSatisfy(progress -> assertThat(progress).isEqualTo((int) distinct));

        List<Integer> continent = JsonPath.read(achievements,
                "$.achievements[?(@.metric == 'CARDS_FROM_CONTINENT' && @.param == '" + firstContinent + "')].progress");
        assertThat(continent).isNotEmpty().allSatisfy(progress -> assertThat(progress).isPositive());

        List<String> rarities = JsonPath.read(achievements, "$.achievements[?(@.metric == 'CARDS_OF_RARITY')].param");
        for (String rarity : rarities.stream().distinct().toList()) {
            int expected = jdbc.sql("select count(*) from cards where id in (:ids) and rarity = :rarity")
                    .param("ids", cardIds).param("rarity", rarity).query(Integer.class).single();
            List<Integer> progress = JsonPath.read(achievements,
                    "$.achievements[?(@.metric == 'CARDS_OF_RARITY' && @.param == '" + rarity + "')].progress");
            assertThat(progress).allSatisfy(value -> assertThat(value).isEqualTo(expected));
        }
    }

    @Test
    void meIncludesProgressionAndPackSections() throws Exception {
        mockMvc.perform(get("/api/v1/me").with(as(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sections.progression.level").value(1))
                .andExpect(jsonPath("$.sections.progression.currentStreak").value(0))
                .andExpect(jsonPath("$.sections.packs.freePacks.available").value(2))
                .andExpect(jsonPath("$.sections.packs.bonusPacks").value(0));
    }
}
