package com.mandat.api.push;

import static com.mandat.api.support.GameTestSupport.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mandat.api.common.scheduling.SchedulerLock;
import com.mandat.api.pack.FreePackTimer;
import com.mandat.api.push.ExpoPushClient.Message;
import com.mandat.api.push.ExpoPushClient.Receipt;
import com.mandat.api.push.ExpoPushClient.Ticket;
import com.mandat.api.push.PushSender.Outcome;
import com.mandat.api.support.GameTestConfig;
import com.mandat.api.support.GameTestConfig.MutableClock;
import com.mandat.api.support.TestUsers;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
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

@SpringBootTest
@AutoConfigureMockMvc
@Import({GameTestConfig.class, PushIntegrationTest.PushTestBeans.class})
class PushIntegrationTest {

    /** 10:00 in Paris (summer time): outside quiet hours. */
    static final Instant MORNING = Instant.parse("2026-06-10T08:00:00Z");

    @Autowired MockMvc mockMvc;
    @Autowired JdbcClient jdbc;
    @Autowired MutableClock clock;
    @Autowired FakeExpoPushClient expo;
    @Autowired PushSender sender;
    @Autowired PushJobs jobs;
    @Autowired SchedulerLock lock;

    @BeforeEach
    void reset() {
        clock.set(MORNING);
        expo.reset();
    }

    // --- Devices and preferences -----------------------------------------------------------------

    @Test
    void registersRefreshesAndUnregistersADevice() throws Exception {
        UUID user = player("Europe/Paris");
        String token = token();
        register(user, token, "en");
        register(user, token, "fr");

        assertThat(jdbc.sql("select count(*) from push_devices where token = :t").param("t", token).query(Integer.class).single())
                .isEqualTo(1);
        assertThat(jdbc.sql("select locale from push_devices where token = :t").param("t", token).query(String.class).single())
                .isEqualTo("fr");

        mockMvc.perform(delete("/api/v1/push/devices/{token}", token).with(as(user))).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/v1/push/devices/{token}", token).with(as(user))).andExpect(status().isNotFound());
    }

    @Test
    void aTokenMovesToTheAccountThatRegistersItLast() throws Exception {
        UUID first = player("Europe/Paris");
        UUID second = player("Europe/Paris");
        String token = token();
        register(first, token, "fr");
        register(second, token, "fr");

        UUID owner = jdbc.sql("select user_id from push_devices where token = :t").param("t", token).query(UUID.class).single();
        assertThat(owner).isEqualTo(second);
    }

    @Test
    void rejectsSomethingThatIsNotAnExpoToken() throws Exception {
        UUID user = player("Europe/Paris");
        mockMvc.perform(post("/api/v1/push/devices").with(as(user)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"not-a-token\",\"platform\":\"ios\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void marketingIsOffByDefaultAndPreferencesArePatchedPartially() throws Exception {
        UUID user = player("Europe/Paris");
        mockMvc.perform(get("/api/v1/push/preferences").with(as(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.boosterReady").value(true))
                .andExpect(jsonPath("$.marketing").value(false));

        mockMvc.perform(patch("/api/v1/push/preferences").with(as(user)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"streak\":false,\"marketing\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.streak").value(false))
                .andExpect(jsonPath("$.marketing").value(true))
                .andExpect(jsonPath("$.friends").value(true));
    }

    @Test
    void deletingTheAccountDeletesItsDevicesAndHistory() throws Exception {
        UUID user = player("Europe/Paris");
        register(user, token(), "fr");
        assertThat(sender.send(user, new PushNotification.BoosterReady(), "booster:1")).isEqualTo(Outcome.SENT);

        jdbc.sql("delete from users where id = :id").param("id", user).update();

        assertThat(count("push_devices", user)).isZero();
        assertThat(count("push_notifications", user)).isZero();
    }

    // --- Sender guards ---------------------------------------------------------------------------

    @Test
    void respectsTheAccountSwitchAndCategoryOptIns() throws Exception {
        UUID user = player("Europe/Paris");
        register(user, token(), "fr");

        jdbc.sql("update users set notifications_enabled = false where id = :id").param("id", user).update();
        assertThat(sender.send(user, new PushNotification.BoosterReady(), "k1")).isEqualTo(Outcome.OPTED_OUT);

        jdbc.sql("update users set notifications_enabled = true where id = :id").param("id", user).update();
        mockMvc.perform(patch("/api/v1/push/preferences").with(as(user)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"boosterReady\":false}")).andExpect(status().isOk());
        assertThat(sender.send(user, new PushNotification.BoosterReady(), "k2")).isEqualTo(Outcome.OPTED_OUT);
        assertThat(sender.send(user, new PushNotification.StreakAtRisk(3), "k3")).isEqualTo(Outcome.SENT);
        assertThat(expo.sent).hasSize(1);
    }

    @Test
    void sendsNothingWithoutADevice() {
        UUID user = player("Europe/Paris");
        assertThat(sender.send(user, new PushNotification.BoosterReady(), "k")).isEqualTo(Outcome.NO_DEVICE);
    }

    @Test
    void dedupesByKeyAndRendersTheDeviceLanguage() throws Exception {
        UUID user = player("Europe/Paris");
        register(user, token(), "en");

        assertThat(sender.send(user, new PushNotification.FriendRequest("Ada"), "same")).isEqualTo(Outcome.SENT);
        assertThat(sender.send(user, new PushNotification.FriendRequest("Ada"), "same")).isEqualTo(Outcome.DUPLICATE);

        Message message = expo.sent.getFirst();
        assertThat(message.title()).isEqualTo("New friend request");
        assertThat(message.body()).contains("Ada");
        assertThat(message.data()).containsEntry("path", "/friends").containsEntry("category", "friends");
    }

    @Test
    void quietHoursDeferWithoutConsumingTheNotification() throws Exception {
        UUID user = player("Europe/Paris");
        register(user, token(), "fr");

        clock.set(Instant.parse("2026-06-10T21:30:00Z")); // 23:30 in Paris
        assertThat(sender.send(user, new PushNotification.BoosterReady(), "night")).isEqualTo(Outcome.QUIET_HOURS);
        clock.set(Instant.parse("2026-06-11T05:00:00Z")); // 07:00 in Paris
        assertThat(sender.send(user, new PushNotification.BoosterReady(), "night")).isEqualTo(Outcome.QUIET_HOURS);

        clock.set(Instant.parse("2026-06-11T07:05:00Z")); // 09:05 in Paris
        assertThat(sender.send(user, new PushNotification.BoosterReady(), "night")).isEqualTo(Outcome.SENT);
    }

    @Test
    void capsTwoPerDayAndOneReminderPerDay() throws Exception {
        UUID user = player("Europe/Paris");
        register(user, token(), "fr");

        assertThat(sender.send(user, new PushNotification.RewardsUnclaimed(), "r1")).isEqualTo(Outcome.SENT);
        assertThat(sender.send(user, new PushNotification.RewardsUnclaimed(), "r2")).isEqualTo(Outcome.CAPPED);
        assertThat(sender.send(user, new PushNotification.BoosterReady(), "b1")).isEqualTo(Outcome.SENT);
        assertThat(sender.send(user, new PushNotification.FriendRequest("Ada"), "f1")).isEqualTo(Outcome.CAPPED);

        clock.advance(Duration.ofDays(1));
        assertThat(sender.send(user, new PushNotification.FriendRequest("Ada"), "f1")).isEqualTo(Outcome.SENT);
    }

    @Test
    void disablesDeadTokensFromTicketsAndReceipts() throws Exception {
        UUID user = player("Europe/Paris");
        String dead = token();
        String alive = token();
        String expired = token();
        register(user, dead, "fr");
        register(user, alive, "fr");
        register(user, expired, "fr");
        expo.ticketErrors.put(dead, ExpoPushClient.DEVICE_NOT_REGISTERED);

        assertThat(sender.send(user, new PushNotification.BoosterReady(), "b")).isEqualTo(Outcome.SENT);
        assertThat(enabled(dead)).isFalse();

        expo.receiptErrors.put(expired, ExpoPushClient.DEVICE_NOT_REGISTERED);
        assertThat(jobs.checkReceipts()).isZero(); // receipts are only read after the delay
        clock.advance(Duration.ofMinutes(16));
        assertThat(jobs.checkReceipts()).isEqualTo(1);

        assertThat(enabled(alive)).isTrue();
        assertThat(enabled(expired)).isFalse();
        assertThat(jdbc.sql("select count(*) from push_tickets where token in (:tokens)")
                .param("tokens", List.of(alive, expired)).query(Integer.class).single()).isZero();
    }

    // --- Scheduled jobs --------------------------------------------------------------------------

    @Test
    void announcesAFreeBoosterOnceWhenItAccrues() throws Exception {
        UUID user = player("Europe/Paris");
        register(user, token(), "fr"); // device registered at MORNING
        // One booster accrues one hour after the registration.
        packState(user, MORNING.plus(Duration.ofHours(1)).minus(FreePackTimer.INTERVAL));

        assertThat(jobs.boosterReady()).isZero();
        clock.advance(Duration.ofHours(2));
        assertThat(jobs.boosterReady()).isEqualTo(1);
        assertThat(jobs.boosterReady()).isZero();
        assertThat(expo.sent.getFirst().data()).containsEntry("path", "/");
    }

    @Test
    void neverAnnouncesTheStarterStockNorABoosterLeftAfterAnOpening() throws Exception {
        UUID newPlayer = player("Europe/Paris");
        register(newPlayer, token(), "fr");
        packState(newPlayer, FreePackTimer.initialAnchor(MORNING)); // full stock before the device existed

        UUID opener = player("Europe/Paris");
        register(opener, token(), "fr");
        Instant openedAt = MORNING.plus(Duration.ofHours(3));
        // Full stock consumed once at openedAt: one booster is left, none newly accrued.
        packState(opener, FreePackTimer.consume(FreePackTimer.initialAnchor(MORNING), openedAt));
        jdbc.sql("""
                insert into pack_openings (id, user_id, pack_id, idempotency_key, response, opened_at)
                values (:id, :user, 's1-standard', 'k', '{}', :at)
                """).param("id", UUID.randomUUID()).param("user", opener).param("at", Timestamp.from(openedAt)).update();

        clock.set(openedAt.plus(Duration.ofMinutes(10)));
        assertThat(jobs.boosterReady()).isZero();
    }

    @Test
    void warnsAtEightPmWhenTheStreakWouldBeLostTonight() throws Exception {
        UUID atRisk = player("Europe/Paris");
        UUID safe = player("Europe/Paris");
        register(atRisk, token(), "fr");
        register(safe, token(), "fr");
        LocalDate today = LocalDate.of(2026, 6, 10);
        progress(atRisk, 4, today.minusDays(1));
        progress(safe, 4, today);

        clock.set(Instant.parse("2026-06-10T16:00:00Z")); // 18:00 in Paris: too early
        assertThat(jobs.streakAtRisk()).isZero();
        clock.set(Instant.parse("2026-06-10T18:15:00Z")); // 20:15 in Paris
        assertThat(jobs.streakAtRisk()).isEqualTo(1);
        assertThat(jobs.streakAtRisk()).isZero();
        assertThat(expo.sent.getFirst().body()).contains("4 jours");
    }

    @Test
    void remindsUnclaimedDailyMissionsInTheEvening() throws Exception {
        UUID user = player("Europe/Paris");
        register(user, token(), "fr");
        jdbc.sql("""
                insert into player_missions (user_id, period, period_key, template_id, type, target, progress, completed_at)
                values (:user, 'daily', 'D:2026-06-10', 'open_packs_1', 'open_packs', 1, 1, :at)
                """).param("user", user).param("at", Timestamp.from(MORNING)).update();

        assertThat(jobs.unclaimedRewards()).isZero(); // 10:00 local
        clock.set(Instant.parse("2026-06-10T16:30:00Z")); // 18:30 local
        assertThat(jobs.unclaimedRewards()).isEqualTo(1);
        assertThat(expo.sent.getFirst().data()).containsEntry("path", "/missions");
    }

    @Test
    void friendRequestsAndAcceptancesArePushed() throws Exception {
        UUID alice = player("Europe/Paris");
        UUID bob = player("Europe/Paris");
        String bobToken = token();
        String aliceToken = token();
        register(bob, bobToken, "fr");
        register(alice, aliceToken, "en");
        String aliceNick = nickname(alice);

        mockMvc.perform(post("/api/v1/friends").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"friendCode\":\"" + friendCode(bob) + "\"}")).andExpect(status().isOk());
        assertThat(expo.sent).singleElement().satisfies(m -> {
            assertThat(m.to()).isEqualTo(bobToken);
            assertThat(m.body()).contains(aliceNick);
        });

        mockMvc.perform(post("/api/v1/friends/{code}/accept", friendCode(alice)).with(as(bob))).andExpect(status().isOk());
        assertThat(expo.sent).hasSize(2);
        assertThat(expo.sent.get(1).to()).isEqualTo(aliceToken);
        assertThat(expo.sent.get(1).title()).isEqualTo("Friend request accepted");
    }

    @Test
    void aJobLeaseIsExclusive() {
        AtomicBoolean innerRan = new AtomicBoolean();
        boolean outer = lock.runExclusively("test.lock", Duration.ofMinutes(5),
                () -> innerRan.set(lock.runExclusively("test.lock", Duration.ofMinutes(5), () -> {})));
        assertThat(outer).isTrue();
        assertThat(innerRan).isFalse();
        assertThat(lock.runExclusively("test.lock", Duration.ofMinutes(5), () -> {})).isTrue();
    }

    // --- Helpers ---------------------------------------------------------------------------------

    private static final AtomicInteger TOKENS = new AtomicInteger();

    private static String token() {
        return "ExponentPushToken[test" + UUID.randomUUID().toString().replace("-", "").substring(0, 16) + TOKENS.incrementAndGet() + "]";
    }

    private UUID player(String timezone) {
        UUID id = TestUsers.create(jdbc);
        jdbc.sql("update users set timezone = :tz where id = :id").param("tz", timezone).param("id", id).update();
        return id;
    }

    private void register(UUID user, String token, String locale) throws Exception {
        mockMvc.perform(post("/api/v1/push/devices").with(as(user)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + token + "\",\"platform\":\"ios\",\"locale\":\"" + locale + "\"}"))
                .andExpect(status().isNoContent());
    }

    private void packState(UUID user, Instant anchor) {
        jdbc.sql("insert into pack_states (user_id, free_packs_anchor) values (:user, :anchor)")
                .param("user", user).param("anchor", Timestamp.from(anchor)).update();
    }

    private void progress(UUID user, int streak, LocalDate lastActive) {
        jdbc.sql("""
                insert into player_progress (user_id, season_id, current_streak, best_streak, last_active_day)
                values (:user, 's1', :streak, :streak, :day)
                """).param("user", user).param("streak", streak).param("day", lastActive).update();
    }

    private boolean enabled(String token) {
        return jdbc.sql("select enabled from push_devices where token = :t").param("t", token).query(Boolean.class).single();
    }

    private int count(String table, UUID user) {
        return jdbc.sql("select count(*) from " + table + " where user_id = :id").param("id", user).query(Integer.class).single();
    }

    private String friendCode(UUID user) {
        return jdbc.sql("select friend_code from users where id = :id").param("id", user).query(String.class).single();
    }

    private String nickname(UUID user) {
        return jdbc.sql("select nickname from users where id = :id").param("id", user).query(String.class).single();
    }

    /** Records sends; per-token errors on tickets or receipts. */
    static final class FakeExpoPushClient implements ExpoPushClient {

        final List<Message> sent = new CopyOnWriteArrayList<>();
        final Map<String, String> ticketErrors = new HashMap<>();
        final Map<String, String> receiptErrors = new HashMap<>();
        private final Map<String, String> tokenByTicket = new HashMap<>();
        private final AtomicInteger ids = new AtomicInteger();

        void reset() {
            sent.clear();
            ticketErrors.clear();
            receiptErrors.clear();
            tokenByTicket.clear();
        }

        @Override
        public List<Ticket> send(List<Message> messages) {
            List<Ticket> tickets = new ArrayList<>();
            for (Message message : messages) {
                sent.add(message);
                String error = ticketErrors.get(message.to());
                if (error != null) {
                    tickets.add(new Ticket("error", null, error));
                } else {
                    String id = "ticket-" + ids.incrementAndGet();
                    tokenByTicket.put(id, message.to());
                    tickets.add(new Ticket("ok", id, null));
                }
            }
            return tickets;
        }

        @Override
        public Map<String, Receipt> receipts(List<String> ticketIds) {
            Map<String, Receipt> receipts = new HashMap<>();
            for (String id : ticketIds) {
                String error = receiptErrors.get(tokenByTicket.get(id));
                receipts.put(id, error == null ? new Receipt("ok", null) : new Receipt("error", error));
            }
            return receipts;
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class PushTestBeans {

        @Bean
        @Primary
        FakeExpoPushClient fakeExpoPushClient() {
            return new FakeExpoPushClient();
        }

        @Bean
        @Primary
        PushDispatcher synchronousPushDispatcher() {
            return new PushDispatcher(Runnable::run);
        }
    }
}
