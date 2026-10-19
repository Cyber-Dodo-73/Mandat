package com.mandat.api.profile;

import static com.mandat.api.support.GameTestSupport.as;
import static com.mandat.api.support.GameTestSupport.newUser;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mandat.api.support.GameTestConfig;
import com.mandat.api.support.GameTestConfig.MutableClock;
import java.sql.Timestamp;
import java.time.Duration;
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
class ProfileSocialApiTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    MutableClock clock;

    UUID alice;
    UUID bob;

    @BeforeEach
    void setUp() {
        clock.set(GameTestConfig.START);
        alice = newUser(jdbc);
        bob = newUser(jdbc);
    }

    // --- Profile & showcase -----------------------------------------------------------------

    @Test
    void newProfileHasDefaultsAndStarterCosmetics() throws Exception {
        mockMvc.perform(get("/api/v1/profile/me").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.avatarId").value("avatar.starter_1"))
                .andExpect(jsonPath("$.profile.bannerId").value("banner.default"))
                .andExpect(jsonPath("$.profile.showcase", hasSize(0)))
                .andExpect(jsonPath("$.profile.stats.seasonCards").value(72))
                .andExpect(jsonPath("$.visibility").value("public"))
                .andExpect(jsonPath("$.unlocks.avatars", hasSize(4)))
                .andExpect(jsonPath("$.nicknameChangeAvailableAt").value(nullValue()));
    }

    @Test
    void showcaseOnlyAcceptsOwnedCardsAndAtMostSix() throws Exception {
        own(alice, "t-001", "standard");
        own(alice, "t-009", "holo");

        updateProfile(alice, "avatar.starter_2", "{\"cardId\":\"t-009\",\"finish\":\"holo\"}",
                "[{\"cardId\":\"t-009\",\"finish\":\"holo\"},{\"cardId\":\"t-001\",\"finish\":\"standard\"}]")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.profile.avatarId").value("avatar.starter_2"))
                .andExpect(jsonPath("$.profile.favoriteCard.cardId").value("t-009"))
                .andExpect(jsonPath("$.profile.showcase[*].cardId", contains("t-009", "t-001")))
                .andExpect(jsonPath("$.profile.stats.distinctCards").value(2))
                .andExpect(jsonPath("$.profile.stats.legendaryCards").value(1));

        // Owned card but not in that finish.
        updateProfile(alice, "avatar.starter_1", null, "[{\"cardId\":\"t-001\",\"finish\":\"gold\"}]")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("card_not_owned"));
        updateProfile(alice, "avatar.starter_1", "{\"cardId\":\"t-002\",\"finish\":\"standard\"}", "[]")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("card_not_owned"));
        updateProfile(alice, "avatar.starter_1", null,
                "[{\"cardId\":\"t-001\",\"finish\":\"standard\"},{\"cardId\":\"t-001\",\"finish\":\"standard\"}]")
                .andExpect(status().isBadRequest());
        String seven = "[" + "{\"cardId\":\"t-001\",\"finish\":\"standard\"},".repeat(6) + "{\"cardId\":\"t-001\",\"finish\":\"standard\"}]";
        updateProfile(alice, "avatar.starter_1", null, seven).andExpect(status().isBadRequest());

        // Nothing of the rejected updates was applied.
        mockMvc.perform(get("/api/v1/profile/me").with(as(alice)))
                .andExpect(jsonPath("$.profile.showcase", hasSize(2)));
    }

    @Test
    void cosmeticsMustBeUnlocked() throws Exception {
        updateProfile(alice, "avatar.level_5", null, "[]")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("cosmetic_locked"));

        jdbc.sql("insert into player_unlocks (user_id, kind, item_id, source, unlocked_at) values (:id, 'avatar', 'avatar.level_5', 'level', now())")
                .param("id", alice).update();
        updateProfile(alice, "avatar.level_5", null, "[]")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unlocks.avatars", hasSize(5)));
    }

    @Test
    void nicknameCanChangeOnceThenAfterTheCooldown() throws Exception {
        String first = "nick" + shortId();
        changeNickname(alice, first).andExpect(status().isOk()).andExpect(jsonPath("$.profile.nickname").value(first));
        changeNickname(alice, "again" + shortId())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("nickname_change_too_soon"));

        clock.advance(Duration.ofDays(31));
        changeNickname(alice, "later" + shortId()).andExpect(status().isOk());

        clock.advance(Duration.ofDays(31));
        changeNickname(alice, "hitler").andExpect(jsonPath("$.code").value("nickname_forbidden"));
    }

    // --- Public profiles, visibility, compare ---------------------------------------------------

    @Test
    void privateProfilesAreVisibleToFriendsOnly() throws Exception {
        updateProfile(bob, "avatar.starter_1", null, "[]", "private").andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/profiles/" + code(bob)).with(as(alice)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("profile_private"));
        mockMvc.perform(get("/api/v1/profiles/" + code(bob) + "/compare").with(as(alice)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/profiles/" + code(bob)).with(as(bob))).andExpect(status().isOk());

        befriend(alice, bob);
        mockMvc.perform(get("/api/v1/profiles/" + code(bob).toLowerCase()).with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.friend").value(true));
        mockMvc.perform(get("/api/v1/profiles/ZZZZZZZZ").with(as(alice))).andExpect(status().isNotFound());
    }

    @Test
    void compareListsCardsEachSideIsMissing() throws Exception {
        own(alice, "t-001", "standard");
        own(alice, "t-002", "standard");
        own(bob, "t-002", "holo");
        own(bob, "t-003", "standard");
        own(bob, "t-003", "gold");

        mockMvc.perform(get("/api/v1/profiles/" + code(bob) + "/compare").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.theyHaveYouDont[*].cardId", contains("t-003")))
                .andExpect(jsonPath("$.theyHaveYouDont[0].finishes", hasSize(2)))
                .andExpect(jsonPath("$.youHaveTheyDont[*].cardId", contains("t-001")))
                .andExpect(jsonPath("$.commonCards").value(1));
    }

    // --- Friends ----------------------------------------------------------------------------

    @Test
    void friendRequestsAreMutual() throws Exception {
        addFriend(alice, code(bob)).andExpect(jsonPath("$.result").value("requested"))
                .andExpect(jsonPath("$.friends.outgoing", hasSize(1)));
        addFriend(alice, code(bob)).andExpect(jsonPath("$.result").value("unchanged"));
        mockMvc.perform(get("/api/v1/friends").with(as(bob)))
                .andExpect(jsonPath("$.incoming[0].friendCode").value(code(alice)))
                .andExpect(jsonPath("$.friends", hasSize(0)));

        addFriend(bob, code(alice)).andExpect(jsonPath("$.result").value("accepted"))
                .andExpect(jsonPath("$.friends.friends[0].friendCode").value(code(alice)));
        mockMvc.perform(get("/api/v1/friends").with(as(alice)))
                .andExpect(jsonPath("$.friends", hasSize(1)))
                .andExpect(jsonPath("$.outgoing", hasSize(0)));

        mockMvc.perform(delete("/api/v1/friends/" + code(bob)).with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.friends", hasSize(0)));
        mockMvc.perform(delete("/api/v1/friends/" + code(bob)).with(as(alice))).andExpect(status().isNotFound());
        addFriend(alice, code(alice)).andExpect(jsonPath("$.code").value("cannot_target_self"));
    }

    @Test
    void acceptEndpointAcceptsAReceivedRequest() throws Exception {
        addFriend(alice, code(bob));
        mockMvc.perform(post("/api/v1/friends/" + code(alice) + "/accept").with(as(alice))).andExpect(status().isNotFound());
        mockMvc.perform(post("/api/v1/friends/" + code(alice) + "/accept").with(as(bob)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.friends", hasSize(1)));
    }

    // --- Reports ----------------------------------------------------------------------------

    @Test
    void reportsAreStoredAndRateLimited() throws Exception {
        for (int i = 0; i < 5; i++) {
            report(alice, code(bob), "offensive_nickname").andExpect(status().isNoContent());
        }
        report(alice, code(bob), "harassment").andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("rate_limited"));
        report(bob, code(bob), "other").andExpect(jsonPath("$.code").value("cannot_target_self"));
        report(bob, code(alice), "spam").andExpect(status().isBadRequest());

        assertThat(jdbc.sql("select count(*) from reports where target_id = :id").param("id", bob).query(Integer.class).single())
                .isEqualTo(5);
    }

    // --- Cross-domain -----------------------------------------------------------------------

    @Test
    void meReportsTheSameFreePacksAsPacksForAFreshPlayerAtNanosecondPrecision() throws Exception {
        clock.set(GameTestConfig.START.plusNanos(123_456_789));
        mockMvc.perform(get("/api/v1/me").with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sections.packs.freePacks.available").value(2))
                .andExpect(jsonPath("$.sections.packs.freePacks.nextAt").value(nullValue()));
        mockMvc.perform(get("/api/v1/packs").with(as(alice)))
                .andExpect(jsonPath("$.freePacks.available").value(2));
    }

    @Test
    void deletingAPlayerCascadesThroughProfileAndSocialTables() throws Exception {
        own(alice, "t-001", "standard");
        updateProfile(alice, "avatar.starter_1", null, "[{\"cardId\":\"t-001\",\"finish\":\"standard\"}]");
        befriend(alice, bob);
        report(alice, code(bob), "other");
        report(bob, code(alice), "other");

        jdbc.sql("delete from users where id = :id").param("id", alice).update();

        for (String table : new String[] {"profiles", "profile_showcase"}) {
            assertThat(jdbc.sql("select count(*) from " + table + " where user_id = :id").param("id", alice)
                    .query(Integer.class).single()).isZero();
        }
        assertThat(jdbc.sql("select count(*) from friendships where requester_id = :id or addressee_id = :id")
                .param("id", alice).query(Integer.class).single()).isZero();
        assertThat(jdbc.sql("select count(*) from reports where reporter_id = :id or target_id = :id")
                .param("id", alice).query(Integer.class).single()).isZero();
    }

    // --- Helpers ----------------------------------------------------------------------------

    private ResultActions updateProfile(UUID user, String avatar, String favorite, String showcase) throws Exception {
        return updateProfile(user, avatar, favorite, showcase, "public");
    }

    private ResultActions updateProfile(UUID user, String avatar, String favorite, String showcase, String visibility)
            throws Exception {
        String body = """
                {"avatarId":"%s","bannerId":"banner.default","titleId":null,"favoriteCard":%s,"showcase":%s,"visibility":"%s"}
                """.formatted(avatar, favorite == null ? "null" : favorite, showcase, visibility);
        return mockMvc.perform(put("/api/v1/profile/me").with(as(user)).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions changeNickname(UUID user, String nickname) throws Exception {
        return mockMvc.perform(put("/api/v1/profile/me/nickname").with(as(user)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nickname\":\"" + nickname + "\"}"));
    }

    private ResultActions addFriend(UUID user, String friendCode) throws Exception {
        return mockMvc.perform(post("/api/v1/friends").with(as(user)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"friendCode\":\"" + friendCode + "\"}"));
    }

    private void befriend(UUID a, UUID b) throws Exception {
        addFriend(a, code(b)).andExpect(jsonPath("$.result").value("requested"));
        addFriend(b, code(a)).andExpect(jsonPath("$.result").value("accepted"));
    }

    private ResultActions report(UUID user, String friendCode, String reason) throws Exception {
        return mockMvc.perform(post("/api/v1/reports").with(as(user)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"friendCode\":\"" + friendCode + "\",\"reason\":\"" + reason + "\",\"note\":\"test\"}"));
    }

    private void own(UUID user, String cardId, String finish) {
        jdbc.sql("""
                insert into collection_items (user_id, card_id, finish, quantity, first_obtained_at, last_obtained_at)
                values (:id, :card, :finish, 1, :now, :now)
                """)
                .param("id", user).param("card", cardId).param("finish", finish)
                .param("now", Timestamp.from(GameTestConfig.START))
                .update();
    }

    private String code(UUID user) {
        return jdbc.sql("select friend_code from users where id = :id").param("id", user).query(String.class).single();
    }

    private static String shortId() {
        return UUID.randomUUID().toString().substring(0, 8);
    }
}
