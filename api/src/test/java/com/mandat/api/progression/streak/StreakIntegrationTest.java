package com.mandat.api.progression.streak;

import static com.mandat.api.support.GameTestSupport.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.mandat.api.common.events.PackOpenedEvent;
import com.mandat.api.push.ExpoPushClient.Message;
import com.mandat.api.support.PushTestSupport.FakeExpoPushClient;
import com.mandat.api.support.PushTestSupport.PushTestBeans;
import com.mandat.api.push.PushJobs;
import com.mandat.api.support.GameTestConfig;
import com.mandat.api.support.GameTestConfig.MutableClock;
import com.mandat.api.support.TestUsers;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest
@AutoConfigureMockMvc
@Import({GameTestConfig.class, PushTestBeans.class})
class StreakIntegrationTest {

    /** Monday 2026-10-19 10:00 UTC (12:00 in Paris), ISO week 2026-W43. */
    static final Instant MONDAY = Instant.parse("2026-10-19T10:00:00Z");
    static final long DAY = 86_400;
    private static final AtomicInteger KEYS = new AtomicInteger();

    @Autowired MockMvc mockMvc;
    @Autowired JdbcClient jdbc;
    @Autowired MutableClock clock;
    @Autowired ApplicationEventPublisher events;
    @Autowired TransactionTemplate tx;
    @Autowired FakeExpoPushClient expo;
    @Autowired PushJobs jobs;

    @BeforeEach
    void reset() {
        clock.set(MONDAY);
        expo.reset();
    }

    // --- Individual streak -------------------------------------------------------------------

    @Test
    void aNewPlayerSeesTheWeeklyFreezeMilestonesAndPrices() throws Exception {
        UUID user = player("UTC");
        mockMvc.perform(get("/api/v1/streak").with(as(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current").value(0))
                .andExpect(jsonPath("$.freezes").value(1))
                .andExpect(jsonPath("$.maxFreezes").value(2))
                .andExpect(jsonPath("$.freezePrices.influence").value(200))
                .andExpect(jsonPath("$.freezePrices.sceaux").doesNotExist())
                .andExpect(jsonPath("$.milestones.length()").value(7))
                .andExpect(jsonPath("$.nextMilestone.days").value(3))
                .andExpect(jsonPath("$.repair.available").value(false));
    }

    @Test
    void milestonesAreRewardedOnceAndGrantFreezes() throws Exception {
        UUID user = player("UTC");
        for (int day = 0; day < 7; day++) {
            play(user, MONDAY.plusSeconds(day * DAY));
        }
        clock.set(MONDAY.plusSeconds(6 * DAY));
        // 3 days: +10 Influence; 7 days: +20 Influence and +1 freeze (stock: W43 weekly + milestone = 2).
        assertThat(milestoneInfluence(user)).isEqualTo(30);
        mockMvc.perform(get("/api/v1/streak").with(as(user)))
                .andExpect(jsonPath("$.current").value(7))
                .andExpect(jsonPath("$.freezes").value(2))
                .andExpect(jsonPath("$.milestones[0].reached").value(true))
                .andExpect(jsonPath("$.milestones[1].reached").value(true))
                .andExpect(jsonPath("$.nextMilestone.days").value(14))
                .andExpect(jsonPath("$.nextMilestone.remaining").value(7));
        mockMvc.perform(get("/api/v1/streak/history").param("days", "8").with(as(user)))
                .andExpect(jsonPath("$.days.length()").value(8))
                .andExpect(jsonPath("$.days[0].status").value("none"))
                .andExpect(jsonPath("$.days[1].status").value("active"))
                .andExpect(jsonPath("$.days[7].status").value("active"));
    }

    @Test
    void missedDaysConsumeFreezesAndShowAsFrozenInTheHistory() throws Exception {
        UUID user = player("UTC");
        play(user, MONDAY);
        play(user, MONDAY.plusSeconds(2 * DAY)); // Tuesday frozen by the weekly freeze
        clock.set(MONDAY.plusSeconds(2 * DAY));
        mockMvc.perform(get("/api/v1/streak").with(as(user)))
                .andExpect(jsonPath("$.current").value(2))
                .andExpect(jsonPath("$.freezes").value(0));
        mockMvc.perform(get("/api/v1/streak/history").param("days", "3").with(as(user)))
                .andExpect(jsonPath("$.days[0].status").value("active"))
                .andExpect(jsonPath("$.days[1].status").value("frozen"))
                .andExpect(jsonPath("$.days[2].status").value("active"));
    }

    @Test
    void aLostStreakCanBeRepairedOncePerMonth() throws Exception {
        UUID user = player("UTC");
        play(user, MONDAY);
        play(user, MONDAY.plusSeconds(DAY));
        // Wednesday and Thursday missed, one freeze: lost on Friday, repairable.
        clock.set(MONDAY.plusSeconds(4 * DAY));
        mockMvc.perform(get("/api/v1/streak").with(as(user)))
                .andExpect(jsonPath("$.current").value(0))
                .andExpect(jsonPath("$.repair.available").value(true))
                .andExpect(jsonPath("$.repair.restoresTo").value(2));
        mockMvc.perform(post("/api/v1/streak/repair").with(as(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current").value(2))
                .andExpect(jsonPath("$.repair.usedThisMonth").value(true));
        play(user, MONDAY.plusSeconds(4 * DAY));
        mockMvc.perform(get("/api/v1/streak").with(as(user))).andExpect(jsonPath("$.current").value(3));

        // A second loss the same month can't be repaired: Saturday and Sunday missed, one freeze (W44).
        clock.set(MONDAY.plusSeconds(7 * DAY));
        mockMvc.perform(get("/api/v1/streak").with(as(user))).andExpect(jsonPath("$.repair.available").value(false));
        mockMvc.perform(post("/api/v1/streak/repair").with(as(user)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("streak_repair_unavailable"));
    }

    @Test
    void freezesCanBeBoughtWithInfluenceIdempotently() throws Exception {
        UUID user = player("UTC");
        setInfluence(user, 500);
        String key = key();
        buy(user, "influence", key).andExpect(status().isOk())
                .andExpect(jsonPath("$.freezes").value(2))
                .andExpect(jsonPath("$.price").value(200))
                .andExpect(jsonPath("$.influence").value(300));
        // Replay: same result, charged once.
        buy(user, "influence", key).andExpect(status().isOk()).andExpect(jsonPath("$.freezes").value(2));
        assertThat(influence(user)).isEqualTo(300);
        assertThat(jdbc.sql("select count(*) from wallet_ledger where user_id = :id and source = 'streak.freeze'")
                .param("id", user).query(Integer.class).single()).isEqualTo(1);
        // Stock full (weekly + bought = 2).
        buy(user, "influence", key()).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("freeze_stock_full"));
    }

    @Test
    void freezePurchaseRefusesSceauxMissingKeysAndEmptyWallets() throws Exception {
        UUID user = player("UTC");
        buy(user, "sceaux", key()).andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("currency_unavailable"));
        mockMvc.perform(post("/api/v1/streak/freezes/purchase").with(as(user)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"currency\":\"influence\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("idempotency_key_required"));
        buy(user, "influence", key()).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("insufficient_influence"));
    }

    // --- Friend streaks ------------------------------------------------------------------------

    @Test
    void friendStreaksCountSharedDaysInEachPlayersTimezone() throws Exception {
        UUID paris = player("Europe/Paris");
        UUID tokyo = player("Asia/Tokyo");
        befriend(paris, tokyo);
        String id = invite(paris, tokyo);
        mockMvc.perform(get("/api/v1/friend-streaks").with(as(tokyo)))
                .andExpect(jsonPath("$.incoming[0].id").value(id));
        mockMvc.perform(post("/api/v1/friend-streaks/{id}/accept", id).with(as(tokyo))).andExpect(status().isOk());

        // Monday: Paris at 12:00 local, Tokyo at 19:00 local — both on their own Monday.
        play(paris, MONDAY);
        play(tokyo, MONDAY);
        // Tuesday.
        play(paris, MONDAY.plusSeconds(DAY));
        play(tokyo, MONDAY.plusSeconds(DAY));
        clock.set(MONDAY.plusSeconds(DAY));
        mockMvc.perform(get("/api/v1/friend-streaks").with(as(paris)))
                .andExpect(jsonPath("$.streaks[0].current").value(2))
                .andExpect(jsonPath("$.streaks[0].meDoneToday").value(true))
                .andExpect(jsonPath("$.streaks[0].friendDoneToday").value(true))
                .andExpect(jsonPath("$.streaks[0].nextMilestone").value(3));

        // Wednesday only Paris plays; Thursday 10:00Z Tokyo's Wednesday is over: broken for both.
        play(paris, MONDAY.plusSeconds(2 * DAY));
        clock.set(MONDAY.plusSeconds(3 * DAY));
        // Tokyo still holds a freeze (W43 weekly): Wednesday is covered, the streak survives.
        mockMvc.perform(get("/api/v1/friend-streaks").with(as(paris))).andExpect(jsonPath("$.streaks[0].current").value(2));
        play(paris, MONDAY.plusSeconds(3 * DAY));
        play(tokyo, MONDAY.plusSeconds(3 * DAY));
        mockMvc.perform(get("/api/v1/friend-streaks").with(as(tokyo))).andExpect(jsonPath("$.streaks[0].current").value(3));
        // Milestone 3 rewarded both (5 Influence each, on top of the personal 3-day milestone of 10).
        assertThat(milestoneInfluence(tokyo)).isEqualTo(15);
        assertThat(milestoneInfluence(paris)).isEqualTo(15);
    }

    @Test
    void friendStreaksAreLimitedAndOnlyBetweenFriends() throws Exception {
        UUID me = player("UTC");
        UUID stranger = player("UTC");
        mockMvc.perform(post("/api/v1/friend-streaks").with(as(me)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"friendCode\":\"" + friendCode(stranger) + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("not_friends"));
        for (int i = 0; i < 5; i++) {
            UUID friend = player("UTC");
            befriend(me, friend);
            invite(me, friend);
        }
        UUID sixth = player("UTC");
        befriend(me, sixth);
        mockMvc.perform(post("/api/v1/friend-streaks").with(as(me)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"friendCode\":\"" + friendCode(sixth) + "\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("friend_streak_limit_reached"));
    }

    @Test
    void inviteAndCrossInviteAccept() throws Exception {
        UUID a = player("UTC");
        UUID b = player("UTC");
        befriend(a, b);
        invite(a, b);
        // B "invites" back: it accepts A's invitation.
        mockMvc.perform(post("/api/v1/friend-streaks").with(as(b)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"friendCode\":\"" + friendCode(a) + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.streaks.length()").value(1))
                .andExpect(jsonPath("$.incoming.length()").value(0));
    }

    // --- Nudges ----------------------------------------------------------------------------------

    @Test
    void nudgesAreLimitedPerFriendAndPerDay() throws Exception {
        UUID sender = player("UTC");
        UUID friend = player("UTC");
        befriend(sender, friend);
        register(friend);
        nudge(sender, friend).andExpect(status().isOk()).andExpect(jsonPath("$.remainingToday").value(9));
        assertThat(expo.sent).hasSize(1);
        assertThat(expo.sent.getFirst().title()).isEqualTo(nickname(sender) + " te relance !");
        nudge(sender, friend).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("nudge_already_sent"));

        mockMvc.perform(get("/api/v1/friends").with(as(sender)))
                .andExpect(jsonPath("$.friends[0].activeToday").value(false))
                .andExpect(jsonPath("$.friends[0].nudgedToday").value(true));

        // An active friend can't be nudged.
        UUID active = player("UTC");
        befriend(sender, active);
        play(active, MONDAY);
        nudge(sender, active).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("friend_already_active"));

        // Max 10 per day: 9 more friends, then the 11th nudge is refused.
        for (int i = 0; i < 9; i++) {
            UUID other = player("UTC");
            befriend(sender, other);
            nudge(sender, other).andExpect(status().isOk());
        }
        UUID eleventh = player("UTC");
        befriend(sender, eleventh);
        nudge(sender, eleventh).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("nudge_limit_reached"));
        // Next day the limit resets.
        clock.set(MONDAY.plusSeconds(DAY));
        nudge(sender, eleventh).andExpect(status().isOk());
    }

    @Test
    void nudgesWaitForTheEndOfQuietHoursAndCanBeMuted() throws Exception {
        UUID sender = player("UTC");
        UUID friend = player("Europe/Paris");
        befriend(sender, friend);
        register(friend);
        // 22:30 in Paris (20:30Z): quiet hours, the nudge is queued.
        clock.set(Instant.parse("2026-10-19T20:30:00Z"));
        nudge(sender, friend).andExpect(status().isOk());
        assertThat(expo.sent).isEmpty();
        assertThat(jobs.flushOutbox()).isZero();
        // 09:10 in Paris: delivered by the outbox job.
        clock.set(Instant.parse("2026-10-20T07:10:00Z"));
        assertThat(jobs.flushOutbox()).isEqualTo(1);
        assertThat(expo.sent).extracting(Message::title).containsExactly(nickname(sender) + " te relance !");
        assertThat(jobs.flushOutbox()).isZero();

        // Muted: nothing is delivered.
        expo.reset();
        mockMvc.perform(patch("/api/v1/push/preferences").with(as(friend)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nudges\":false}"))
                .andExpect(jsonPath("$.nudges").value(false));
        nudge(sender, friend).andExpect(status().isOk());
        assertThat(expo.sent).isEmpty();
    }

    @Test
    void friendStreakAtRiskRemindsTheFriendWhoHasNotPlayed() throws Exception {
        UUID a = player("UTC");
        UUID b = player("UTC");
        befriend(a, b);
        String id = invite(a, b);
        mockMvc.perform(post("/api/v1/friend-streaks/{id}/accept", id).with(as(b))).andExpect(status().isOk());
        play(a, MONDAY);
        play(b, MONDAY);
        register(b);
        play(a, MONDAY.plusSeconds(DAY)); // Tuesday: A played, B not yet
        clock.set(MONDAY.plusSeconds(DAY).plusSeconds(10 * 3600)); // 20:00 UTC
        assertThat(jobs.friendStreakAtRisk()).isEqualTo(1);
        assertThat(expo.sent.getFirst().title()).isEqualTo("Votre série à deux est en danger");
        assertThat(jobs.friendStreakAtRisk()).isZero(); // once per day
    }

    // --- Helpers -------------------------------------------------------------------------------

    private UUID player(String timezone) {
        return TestUsers.create(jdbc, UUID.randomUUID(), timezone);
    }

    private void play(UUID user, Instant at) {
        tx.executeWithoutResult(s -> events.publishEvent(new PackOpenedEvent(user, "standard",
                List.of("c-1", "c-2", "c-3", "c-4", "c-5"), List.of(), at)));
    }

    private void befriend(UUID a, UUID b) {
        jdbc.sql("""
                insert into friendships (requester_id, addressee_id, status, created_at, accepted_at)
                values (:a, :b, 'accepted', :now, :now)""")
                .param("a", a).param("b", b).param("now", Timestamp.from(MONDAY)).update();
    }

    private String invite(UUID from, UUID to) throws Exception {
        String body = mockMvc.perform(post("/api/v1/friend-streaks").with(as(from)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"friendCode\":\"" + friendCode(to) + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        List<String> ids = JsonPath.read(body, "$.outgoing[?(@.friend.friendCode == '" + friendCode(to) + "')].id");
        return ids.getFirst();
    }

    private ResultActions nudge(UUID from, UUID to) throws Exception {
        return mockMvc.perform(post("/api/v1/friends/{code}/nudge", friendCode(to)).with(as(from)));
    }

    private ResultActions buy(UUID user, String currency, String key) throws Exception {
        return mockMvc.perform(post("/api/v1/streak/freezes/purchase").with(as(user)).header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON).content("{\"currency\":\"" + currency + "\"}"));
    }

    private void register(UUID user) throws Exception {
        String token = "ExponentPushToken[streak" + UUID.randomUUID().toString().replace("-", "").substring(0, 16) + "]";
        mockMvc.perform(post("/api/v1/push/devices").with(as(user)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + token + "\",\"platform\":\"ios\",\"locale\":\"fr\"}"))
                .andExpect(status().isNoContent());
    }

    private void setInfluence(UUID user, int value) {
        jdbc.sql("update users set influence = :v where id = :id").param("v", value).param("id", user).update();
    }

    private int influence(UUID user) {
        return jdbc.sql("select influence from users where id = :id").param("id", user).query(Integer.class).single();
    }

    private int milestoneInfluence(UUID user) {
        return jdbc.sql("select coalesce(sum(delta), 0) from wallet_ledger where user_id = :id and source = 'streak.milestone' and currency = 'influence'")
                .param("id", user).query(Integer.class).single();
    }

    private String friendCode(UUID user) {
        return jdbc.sql("select friend_code from users where id = :id").param("id", user).query(String.class).single();
    }

    private String nickname(UUID user) {
        return jdbc.sql("select nickname from users where id = :id").param("id", user).query(String.class).single();
    }

    private static String key() {
        return "freeze-" + KEYS.incrementAndGet() + "-" + UUID.randomUUID();
    }
}
