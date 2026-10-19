package com.mandat.api.progression;

import com.mandat.api.support.TestUsers;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.mandat.api.TestcontainersConfig;
import com.mandat.api.common.events.DuelFinishedEvent;
import com.mandat.api.common.events.PackOpenedEvent;
import com.mandat.api.common.events.QuizCompletedEvent;
import com.mandat.api.common.progression.CardInfo;
import com.mandat.api.common.progression.CardInfoProvider;
import com.mandat.api.common.progression.CollectionStatsProvider;
import com.mandat.api.common.progression.PlayerLevelProvider;
import com.mandat.api.common.security.AuthenticatedUser;
import com.mandat.api.common.wallet.WalletService;
import com.mandat.api.progression.level.XpService;
import com.mandat.api.progression.mission.MissionAssigner;
import com.mandat.api.progression.mission.MissionCatalog;
import com.mandat.api.progression.mission.MissionCatalog.Period;
import com.mandat.api.progression.mission.MissionCatalog.Template;
import com.mandat.api.progression.mission.MissionType;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Predicate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfig.class, ProgressionIntegrationTest.TestBeans.class})
class ProgressionIntegrationTest {

    /** Monday 2026-10-19 10:00 UTC (ISO week 2026-W43). */
    static final Instant START = Instant.parse("2026-10-19T10:00:00Z");

    @Autowired MockMvc mockMvc;
    @Autowired JdbcClient jdbc;
    @Autowired ApplicationEventPublisher events;
    @Autowired TransactionTemplate tx;
    @Autowired MutableClock clock;
    @Autowired FakeCollectionStats collectionStats;
    @Autowired XpService xpService;
    @Autowired WalletService wallet;
    @Autowired PlayerLevelProvider levelProvider;
    @Autowired MissionCatalog missionCatalog;

    @BeforeEach
    void reset() {
        clock.set(START);
        collectionStats.distinctCards = 0;
    }

    // --- XP and levels -------------------------------------------------------------------

    @Test
    void levelUpGrantsLevelRewards() throws Exception {
        UUID user = newUser("Europe/Paris");

        XpService.XpGrant grant = tx.execute(s -> xpService.grant(user, 260, START));

        assertThat(grant.level()).isEqualTo(3);
        assertThat(grant.levelsGained()).containsExactly(2, 3);
        // Level 2: 50 Influence + 1 booster; level 3: 50 Influence.
        assertThat(grant.levelRewards().influence()).isEqualTo(100);
        assertThat(grant.levelRewards().bonusPacks()).isEqualTo(1);
        assertThat(balance(user)).isEqualTo(new WalletService.Balance(100, 1));
        assertThat(levelProvider.levelOf(user)).isEqualTo(3);

        mockMvc.perform(get("/api/v1/progression").with(as(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.level").value(3))
                .andExpect(jsonPath("$.totalXp").value(260))
                .andExpect(jsonPath("$.xpIntoLevel").value(10))
                .andExpect(jsonPath("$.xpForNextLevel").value(200))
                .andExpect(jsonPath("$.seasonXp").value(260))
                .andExpect(jsonPath("$.influence").value(100))
                .andExpect(jsonPath("$.bonusPacks").value(1))
                .andExpect(jsonPath("$.timezone").value("Europe/Paris"))
                .andExpect(jsonPath("$.dailyResetAt").value("2026-10-19T22:00:00Z"))
                .andExpect(jsonPath("$.weeklyResetAt").value("2026-10-25T23:00:00Z"));
    }

    @Test
    void levelOfUnknownPlayerIsOne() {
        assertThat(levelProvider.levelOf(UUID.randomUUID())).isEqualTo(1);
    }

    // --- Streak --------------------------------------------------------------------------

    @Test
    void streakFollowsThePlayersCalendarDaysAcrossDst() throws Exception {
        UUID user = newUser("America/Los_Angeles");
        // Sat 2026-03-07 23:30 PST, then Sun 00:30 PST one hour later: two calendar days.
        openPack(user, Instant.parse("2026-03-08T07:30:00Z"));
        openPack(user, Instant.parse("2026-03-08T08:30:00Z"));
        // DST starts Sun 2026-03-08 02:00. Sun 23:00 PDT then Mon 00:30 PDT.
        openPack(user, Instant.parse("2026-03-09T06:00:00Z"));
        openPack(user, Instant.parse("2026-03-09T07:30:00Z"));

        clock.set(Instant.parse("2026-03-09T08:00:00Z"));
        mockMvc.perform(get("/api/v1/progression").with(as(user)))
                .andExpect(jsonPath("$.currentStreak").value(3))
                .andExpect(jsonPath("$.bestStreak").value(3))
                .andExpect(jsonPath("$.streakActiveToday").value(true));
    }

    @Test
    void sameInstantIsADifferentDayInAnotherTimezone() throws Exception {
        UUID kiritimati = newUser("Pacific/Kiritimati"); // UTC+14
        UUID utc = newUser("UTC");
        // 09:00Z and 11:00Z: for UTC same day; in UTC+14 it's 23:00 then 01:00 the next day.
        for (UUID user : List.of(kiritimati, utc)) {
            completeQuiz(user, Instant.parse("2026-10-19T09:00:00Z"), 10);
            completeQuiz(user, Instant.parse("2026-10-19T11:00:00Z"), 10);
        }
        clock.set(Instant.parse("2026-10-19T11:30:00Z"));
        mockMvc.perform(get("/api/v1/progression").with(as(kiritimati))).andExpect(jsonPath("$.currentStreak").value(2));
        mockMvc.perform(get("/api/v1/progression").with(as(utc))).andExpect(jsonPath("$.currentStreak").value(1));
    }

    @Test
    void freezeCoversOneMissedDayThenStreakBreaks() throws Exception {
        UUID user = newUser("UTC");
        openPack(user, Instant.parse("2026-10-19T12:00:00Z")); // Mon
        openPack(user, Instant.parse("2026-10-20T12:00:00Z")); // Tue
        openPack(user, Instant.parse("2026-10-22T12:00:00Z")); // Thu (Wed frozen)

        clock.set(Instant.parse("2026-10-22T13:00:00Z"));
        mockMvc.perform(get("/api/v1/progression").with(as(user)))
                .andExpect(jsonPath("$.currentStreak").value(3))
                .andExpect(jsonPath("$.freezeAvailable").value(false));

        // Friday missed, Saturday the freeze of W43 is already used: shown as broken.
        clock.set(Instant.parse("2026-10-24T08:00:00Z"));
        mockMvc.perform(get("/api/v1/progression").with(as(user))).andExpect(jsonPath("$.currentStreak").value(0));
        openPack(user, Instant.parse("2026-10-24T09:00:00Z"));
        mockMvc.perform(get("/api/v1/progression").with(as(user)))
                .andExpect(jsonPath("$.currentStreak").value(1))
                .andExpect(jsonPath("$.bestStreak").value(3));
    }

    // --- Missions --------------------------------------------------------------------------

    @Test
    void missionsAreStableWithinAPeriod() throws Exception {
        UUID user = newUser("Europe/Paris");
        String first = mockMvc.perform(get("/api/v1/missions").with(as(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.daily.length()").value(3))
                .andExpect(jsonPath("$.weekly.length()").value(3))
                .andExpect(jsonPath("$.dailyResetAt").value("2026-10-19T22:00:00Z"))
                .andReturn().getResponse().getContentAsString();
        clock.set(START.plus(Duration.ofHours(5)));
        String second = mockMvc.perform(get("/api/v1/missions").with(as(user)))
                .andReturn().getResponse().getContentAsString();
        assertThat(missionIds(second)).isEqualTo(missionIds(first));
    }

    @Test
    void completedMissionCanBeClaimedOnce() throws Exception {
        UUID user = userWithDailyMission(t -> t.type() == MissionType.OPEN_PACKS, "UTC");
        Template template = expectedDaily(user).stream().filter(t -> t.type() == MissionType.OPEN_PACKS).findFirst().orElseThrow();
        String missionId = missionId(user, template.id());

        mockMvc.perform(post("/api/v1/missions/{id}/claim", missionId).with(as(user)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("reward_not_claimable"));

        for (int i = 0; i < template.target(); i++) {
            openPack(user, START.plusSeconds(60L * (i + 1)));
        }
        int influenceBefore = balance(user).influence();

        mockMvc.perform(post("/api/v1/missions/{id}/claim", missionId).with(as(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reward.xp").value(template.reward().xp()))
                .andExpect(jsonPath("$.reward.influence").value(template.reward().influence()));
        assertThat(balance(user).influence()).isGreaterThanOrEqualTo(influenceBefore + template.reward().influence());

        mockMvc.perform(post("/api/v1/missions/{id}/claim", missionId).with(as(user)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("reward_already_claimed"));
        mockMvc.perform(get("/api/v1/missions").with(as(user)))
                .andExpect(jsonPath("$.daily[?(@.templateId == '" + template.id() + "')].claimed").value(true));
    }

    @Test
    void continentMissionCountsOnlyNewCardsOfThatContinent() throws Exception {
        UUID user = userWithDailyMission(t -> t.type() == MissionType.NEW_CARDS_FROM_CONTINENT, "UTC");
        Template template = expectedDaily(user).stream()
                .filter(t -> t.type() == MissionType.NEW_CARDS_FROM_CONTINENT).findFirst().orElseThrow();
        String other = template.param().equals("europe") ? "asia" : "europe";
        String missionPath = "$.daily[?(@.templateId == '" + template.id() + "')]";

        publishInTx(new PackOpenedEvent(user, "standard", List.of("c-" + other), List.of("c-" + other), START));
        mockMvc.perform(get("/api/v1/missions").with(as(user)))
                .andExpect(jsonPath(missionPath + ".progress").value(0));

        publishInTx(new PackOpenedEvent(user, "standard", List.of("c-" + template.param()), List.of("c-" + template.param()), START));
        mockMvc.perform(get("/api/v1/missions").with(as(user)))
                .andExpect(jsonPath(missionPath + ".progress").value(1))
                .andExpect(jsonPath(missionPath + ".completed").value(true));
    }

    @Test
    void weeklyMissionsResetOnMondayInThePlayersTimezone() throws Exception {
        UUID user = userWithWeeklyMission(t -> t.type() == MissionType.PLAY_DUEL, "Asia/Tokyo");
        Template template = expectedWeekly(user, "W:2026-W43").stream()
                .filter(t -> t.type() == MissionType.PLAY_DUEL).findFirst().orElseThrow();
        String oldMissionId = missionId(user, template.id());
        for (int i = 0; i < template.target(); i++) {
            publishInTx(new DuelFinishedEvent(user, UUID.randomUUID(), false, "easy", START));
        }

        // Sunday 23:30 in Tokyo is still week 43.
        clock.set(Instant.parse("2026-10-25T14:30:00Z"));
        mockMvc.perform(get("/api/v1/missions").with(as(user)))
                .andExpect(jsonPath("$.weeklyResetAt").value("2026-10-25T15:00:00Z"));
        assertThat(currentWeeklyIds(user)).contains(oldMissionId);

        // Monday 00:30 in Tokyo: a new week with new missions; the old one can't be claimed.
        clock.set(Instant.parse("2026-10-25T15:30:00Z"));
        assertThat(currentWeeklyIds(user)).doesNotContain(oldMissionId).hasSize(3);
        mockMvc.perform(post("/api/v1/missions/{id}/claim", oldMissionId).with(as(user)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("mission_expired"));
    }

    @Test
    void claimingSomeoneElsesMissionIsNotFound() throws Exception {
        UUID owner = newUser("UTC");
        UUID intruder = newUser("UTC");
        String body = mockMvc.perform(get("/api/v1/missions").with(as(owner))).andReturn().getResponse().getContentAsString();
        String missionId = JsonPath.read(body, "$.daily[0].id");
        mockMvc.perform(post("/api/v1/missions/{id}/claim", missionId).with(as(intruder)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("not_found"));
    }

    // --- Achievements ------------------------------------------------------------------------

    @Test
    void achievementsUnlockFromEventsAndGrantRewards() throws Exception {
        UUID user = newUser("UTC");
        openPack(user, START);
        completeQuiz(user, START, 10);
        publishInTx(new DuelFinishedEvent(user, UUID.randomUUID(), true, "hard", START));

        String body = mockMvc.perform(get("/api/v1/achievements").with(as(user)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        int total = JsonPath.read(body, "$.totalCount");
        assertThat(total).isGreaterThanOrEqualTo(50);
        for (String id : List.of("packs_1", "quiz_1", "quiz_perfect_1", "duel_win_1")) {
            List<String> unlockedAt = JsonPath.read(body, "$.achievements[?(@.id == '" + id + "')].unlockedAt");
            assertThat(unlockedAt).as(id).hasSize(1).doesNotContainNull();
        }
        List<Integer> packs10 = JsonPath.read(body, "$.achievements[?(@.id == 'packs_10')].progress");
        assertThat(packs10).containsExactly(1);
        assertThat((Integer) JsonPath.read(body, "$.unlockedCount")).isEqualTo(4);
        // packs_1 (25) + quiz_1 (25) + quiz_perfect_1 (50) + duel_win_1 (25) Influence at least.
        assertThat(balance(user).influence()).isGreaterThanOrEqualTo(125);
    }

    @Test
    void collectionAchievementsUseTheCollectionProvider() throws Exception {
        UUID user = newUser("UTC");
        collectionStats.distinctCards = 12;
        openPack(user, START);
        String body = mockMvc.perform(get("/api/v1/achievements").with(as(user))).andReturn().getResponse().getContentAsString();
        List<String> unlocked = JsonPath.read(body, "$.achievements[?(@.id == 'collection_10')].unlockedAt");
        assertThat(unlocked).doesNotContainNull().hasSize(1);
        List<Integer> progress50 = JsonPath.read(body, "$.achievements[?(@.id == 'collection_50')].progress");
        assertThat(progress50).containsExactly(12);
    }

    @Test
    void levelAchievementsUnlockAfterLevelUps() {
        UUID user = newUser("UTC");
        tx.executeWithoutResult(s -> xpService.grant(user, 1_000, START)); // level 6

        publishInTx(new DuelFinishedEvent(user, UUID.randomUUID(), false, "easy", START));
        List<String> unlocked = jdbc.sql("select achievement_id from player_achievements where user_id = :id")
                .param("id", user).query(String.class).list();
        assertThat(unlocked).contains("level_5");
    }

    // --- Season pass ---------------------------------------------------------------------------

    @Test
    void seasonPassTiersAreClaimedOnceWhenReached() throws Exception {
        UUID user = newUser("UTC");
        tx.executeWithoutResult(s -> xpService.grant(user, 450, START));

        mockMvc.perform(get("/api/v1/season-pass").with(as(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.seasonId").value("s1"))
                .andExpect(jsonPath("$.seasonXp").value(450))
                .andExpect(jsonPath("$.currentTier").value(2))
                .andExpect(jsonPath("$.tiers.length()").value(50))
                .andExpect(jsonPath("$.tiers[1].claimable").value(true))
                .andExpect(jsonPath("$.tiers[2].claimable").value(false));

        int influenceBefore = balance(user).influence();
        mockMvc.perform(post("/api/v1/season-pass/1/claim").with(as(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reward.influence").value(50));
        assertThat(balance(user).influence()).isEqualTo(influenceBefore + 50);

        mockMvc.perform(post("/api/v1/season-pass/1/claim").with(as(user)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("reward_already_claimed"));
        mockMvc.perform(post("/api/v1/season-pass/3/claim").with(as(user)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("reward_not_claimable"));
        mockMvc.perform(post("/api/v1/season-pass/51/claim").with(as(user)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("season_tier_not_found"));
        mockMvc.perform(get("/api/v1/season-pass").with(as(user)))
                .andExpect(jsonPath("$.tiers[0].claimed").value(true))
                .andExpect(jsonPath("$.tiers[0].claimable").value(false));
    }

    @Test
    void endpointsRequireAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/progression")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/missions")).andExpect(status().isUnauthorized());
    }

    // --- Helpers --------------------------------------------------------------------------------

    private UUID newUser(String timezone) {
        return TestUsers.create(jdbc, UUID.randomUUID(), timezone);
    }

    /** Finds a user id whose deterministic daily assignment (for START's day) contains a matching template. */
    private UUID userWithDailyMission(Predicate<Template> wanted, String timezone) {
        while (true) {
            UUID candidate = UUID.randomUUID();
            if (MissionAssigner.assign(missionCatalog.pool(Period.daily), candidate, "D:2026-10-19").stream().anyMatch(wanted)) {
                return TestUsers.create(jdbc, candidate, timezone);
            }
        }
    }

    private UUID userWithWeeklyMission(Predicate<Template> wanted, String timezone) {
        while (true) {
            UUID candidate = UUID.randomUUID();
            if (MissionAssigner.assign(missionCatalog.pool(Period.weekly), candidate, "W:2026-W43").stream().anyMatch(wanted)) {
                return TestUsers.create(jdbc, candidate, timezone);
            }
        }
    }

    private List<Template> expectedDaily(UUID user) {
        return MissionAssigner.assign(missionCatalog.pool(Period.daily), user, "D:2026-10-19");
    }

    private List<Template> expectedWeekly(UUID user, String key) {
        return MissionAssigner.assign(missionCatalog.pool(Period.weekly), user, key);
    }

    private String missionId(UUID user, String templateId) throws Exception {
        String body = mockMvc.perform(get("/api/v1/missions").with(as(user))).andReturn().getResponse().getContentAsString();
        List<String> daily = JsonPath.read(body, "$.daily[?(@.templateId == '" + templateId + "')].id");
        List<String> weekly = JsonPath.read(body, "$.weekly[?(@.templateId == '" + templateId + "')].id");
        return daily.isEmpty() ? weekly.getFirst() : daily.getFirst();
    }

    private List<String> currentWeeklyIds(UUID user) throws Exception {
        String body = mockMvc.perform(get("/api/v1/missions").with(as(user))).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.weekly[*].id");
    }

    private static List<String> missionIds(String body) {
        List<String> daily = JsonPath.read(body, "$.daily[*].id");
        List<String> weekly = JsonPath.read(body, "$.weekly[*].id");
        return List.of(String.join(",", daily), String.join(",", weekly));
    }

    private void openPack(UUID user, Instant at) {
        publishInTx(new PackOpenedEvent(user, "standard", List.of("c-1", "c-2", "c-3", "c-4", "c-5"), List.of(), at));
    }

    private void completeQuiz(UUID user, Instant at, int correct) {
        publishInTx(new QuizCompletedEvent(user, UUID.randomUUID(), correct, 10, at));
    }

    private void publishInTx(Object event) {
        tx.executeWithoutResult(s -> events.publishEvent(event));
    }

    private WalletService.Balance balance(UUID user) {
        return wallet.balance(user);
    }

    private static RequestPostProcessor as(UUID user) {
        return authentication(new UsernamePasswordAuthenticationToken(new AuthenticatedUser(user), null, List.of()));
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class TestBeans {

        @Bean
        @Primary
        MutableClock mutableClock() {
            return new MutableClock(START);
        }

        @Bean
        FakeCollectionStats fakeCollectionStats() {
            return new FakeCollectionStats();
        }

        /** Card ids "c-<continent>" belong to that continent; everything is rare. */
        @Bean
        CardInfoProvider fakeCardInfo() {
            Map<String, CardInfo> cache = new HashMap<>();
            return cardId -> Optional.of(cache.computeIfAbsent(cardId,
                    id -> new CardInfo(id, "rare", id.startsWith("c-") ? id.substring(2) : "europe", "modern")));
        }
    }

    static final class MutableClock extends Clock {

        private volatile Instant now;

        MutableClock(Instant now) {
            this.now = now;
        }

        void set(Instant instant) {
            this.now = instant;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }

    static final class FakeCollectionStats implements CollectionStatsProvider {

        volatile int distinctCards;

        @Override
        public int distinctCards(UUID userId) {
            return distinctCards;
        }

        @Override
        public int distinctCardsByContinent(UUID userId, String continent) {
            return 0;
        }

        @Override
        public int distinctCardsByEra(UUID userId, String era) {
            return 0;
        }

        @Override
        public int distinctCardsByRarity(UUID userId, String rarity) {
            return 0;
        }

        @Override
        public int distinctCardsByFinish(UUID userId, String finish) {
            return 0;
        }
    }
}
