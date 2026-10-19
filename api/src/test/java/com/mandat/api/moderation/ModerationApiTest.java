package com.mandat.api.moderation;

import static com.mandat.api.support.GameTestSupport.as;
import static com.mandat.api.support.GameTestSupport.newUser;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.mandat.api.support.GameTestConfig;
import java.nio.charset.StandardCharsets;
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
class ModerationApiTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcClient jdbc;

    UUID alice;
    UUID bob;

    @BeforeEach
    void setUp() {
        alice = newUser(jdbc);
        bob = newUser(jdbc);
    }

    // --- Blocking ----------------------------------------------------------------------------

    @Test
    void blockingEndsTheFriendshipAndHidesBothSides() throws Exception {
        befriend(alice, bob);

        mockMvc.perform(post("/api/v1/blocks").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"friendCode\":\"" + code(bob) + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].friendCode").value(code(bob)));
        mockMvc.perform(get("/api/v1/friends").with(as(alice))).andExpect(jsonPath("$.friends", hasSize(0)));

        // Neither side can reach the other; the answer is the one of an unknown code.
        for (UUID[] pair : new UUID[][] {{alice, bob}, {bob, alice}}) {
            mockMvc.perform(get("/api/v1/profiles/" + code(pair[1])).with(as(pair[0])))
                    .andExpect(status().isNotFound());
            mockMvc.perform(get("/api/v1/profiles/" + code(pair[1]) + "/compare").with(as(pair[0])))
                    .andExpect(status().isNotFound());
            addFriend(pair[0], code(pair[1])).andExpect(status().isNotFound());
        }

        mockMvc.perform(delete("/api/v1/blocks/" + code(bob)).with(as(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
        addFriend(bob, code(alice)).andExpect(status().isOk()).andExpect(jsonPath("$.result").value("requested"));
    }

    @Test
    void cannotBlockYourself() throws Exception {
        mockMvc.perform(post("/api/v1/blocks").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"friendCode\":\"" + code(alice) + "\"}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("cannot_target_self"));
    }

    // --- Admin ---------------------------------------------------------------------------------

    @Test
    void adminEndpointsAreForbiddenToPlayers() throws Exception {
        mockMvc.perform(get("/api/v1/admin/reports").with(as(alice)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("forbidden"));
        mockMvc.perform(post("/api/v1/admin/players/" + code(bob) + "/rename").with(as(alice)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/admin/reports")).andExpect(status().isUnauthorized());
    }

    @Test
    void adminHandlesReportsBansAndRenames() throws Exception {
        UUID admin = newUser(jdbc);
        jdbc.sql("update users set role = 'admin' where id = :id").param("id", admin).update();
        mockMvc.perform(post("/api/v1/reports").with(as(alice)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"friendCode\":\"" + code(bob) + "\",\"reason\":\"offensive_nickname\"}"))
                .andExpect(status().isNoContent());

        String reports = mockMvc.perform(get("/api/v1/admin/reports").with(as(admin)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        String reportId = JsonPath.read(reports, "$.reports[?(@.targetFriendCode == '" + code(bob) + "')].id")
                .toString().replaceAll("[\\[\\]\"]", "");

        String oldNickname = nickname(bob);
        mockMvc.perform(post("/api/v1/admin/players/" + code(bob) + "/rename").with(as(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nickname").value(not(oldNickname)));
        assertThat(jdbc.sql("select resolution from reports where id = :id").param("id", UUID.fromString(reportId))
                .query(String.class).single()).isEqualTo("renamed");

        mockMvc.perform(post("/api/v1/admin/players/" + code(bob) + "/ban").with(as(admin))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"spam\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.banned").value(true));
        // A banned profile is hidden.
        mockMvc.perform(get("/api/v1/profiles/" + code(bob)).with(as(alice))).andExpect(status().isNotFound());

        mockMvc.perform(delete("/api/v1/admin/players/" + code(bob) + "/ban").with(as(admin)))
                .andExpect(jsonPath("$.banned").value(false));
        mockMvc.perform(post("/api/v1/admin/reports/" + reportId + "/handled").with(as(admin)))
                .andExpect(status().isNoContent());
    }

    private ResultActions addFriend(UUID user, String friendCode) throws Exception {
        return mockMvc.perform(post("/api/v1/friends").with(as(user)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"friendCode\":\"" + friendCode + "\"}"));
    }

    private void befriend(UUID a, UUID b) throws Exception {
        addFriend(a, code(b)).andExpect(jsonPath("$.result").value("requested"));
        addFriend(b, code(a)).andExpect(jsonPath("$.result").value("accepted"));
    }

    private String code(UUID user) {
        return jdbc.sql("select friend_code from users where id = :id").param("id", user).query(String.class).single();
    }

    private String nickname(UUID user) {
        return jdbc.sql("select nickname from users where id = :id").param("id", user).query(String.class).single();
    }
}
