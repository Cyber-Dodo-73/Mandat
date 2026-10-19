package com.mandat.api.quiz;

import static com.mandat.api.support.GameTestSupport.as;
import static com.mandat.api.support.GameTestSupport.ledger;
import static com.mandat.api.support.GameTestSupport.newUser;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.mandat.api.common.wallet.WalletSource;
import com.mandat.api.support.GameTestConfig;
import com.mandat.api.support.GameTestConfig.MutableClock;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
@Import(GameTestConfig.class)
class QuizApiTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    MutableClock clock;

    @Autowired
    JsonMapper jsonMapper;

    @AfterEach
    void resetClock() {
        clock.set(GameTestConfig.START);
    }

    @Test
    void sessionNeverSendsAnswersBeforeTheyAreGiven() throws Exception {
        UUID user = newUser(jdbc);
        String body = start(user, "fr").andExpect(status().isCreated())
                .andExpect(jsonPath("$.questions", hasSize(10)))
                .andExpect(jsonPath("$.lives").value(3))
                .andExpect(jsonPath("$.status").value("active"))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).doesNotContain("\"answer\"").doesNotContain("explanation").doesNotContain("subjectCardId");
        List<String> prompts = JsonPath.read(body, "$.questions[*].prompt");
        assertThat(prompts).allSatisfy(prompt -> assertThat(prompt).isNotBlank());
    }

    @Test
    void englishSessionWhenAskedInEnglish() throws Exception {
        UUID user = newUser(jdbc);
        String body = start(user, "en-US,en;q=0.9").andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        String language = jdbc.sql("select language from quiz_sessions where id = :id")
                .param("id", UUID.fromString(JsonPath.read(body, "$.id"))).query(String.class).single();
        assertThat(language).isEqualTo("en");
    }

    @Test
    void perfectQuizGrantsInfluenceAndEveryFifthABonusBooster() throws Exception {
        UUID user = newUser(jdbc);
        for (int quiz = 1; quiz <= 5; quiz++) {
            UUID session = sessionId(start(user, "fr"));
            List<List<String>> answers = correctAnswers(session);
            String last = null;
            for (int i = 0; i < 10; i++) {
                last = answer(user, session, i, answers.get(i)).andExpect(status().isOk())
                        .andExpect(jsonPath("$.correct").value(true))
                        .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
            }
            assertThat((Boolean) JsonPath.read(last, "$.finished")).isTrue();
            assertThat((Boolean) JsonPath.read(last, "$.result.perfect")).isTrue();
            assertThat((Integer) JsonPath.read(last, "$.result.influence")).isEqualTo(30);
            assertThat((Boolean) JsonPath.read(last, "$.result.bonusPack")).isEqualTo(quiz == 5);
        }
        assertThat(ledger(jdbc, user, "influence", WalletSource.QUIZ_REWARD)).isEqualTo(5 * 30);
        assertThat(ledger(jdbc, user, "bonus_packs", WalletSource.QUIZ_REWARD)).isEqualTo(1);
        // The completion event reached progression.
        Integer perfectQuizzes = jdbc.sql("select perfect_quizzes from player_stats where user_id = :id")
                .param("id", user).query(Integer.class).optional().orElse(null);
        assertThat(perfectQuizzes).isEqualTo(5);
    }

    @Test
    void threeWrongAnswersEndTheQuiz() throws Exception {
        UUID user = newUser(jdbc);
        UUID session = sessionId(start(user, "fr"));
        answer(user, session, 0, List.of("wrong")).andExpect(jsonPath("$.lives").value(2))
                .andExpect(jsonPath("$.correct").value(false))
                .andExpect(jsonPath("$.correctAnswer").isArray())
                .andExpect(jsonPath("$.result").value(nullValue()));
        answer(user, session, 1, List.of("wrong")).andExpect(jsonPath("$.lives").value(1));
        answer(user, session, 2, List.of("wrong"))
                .andExpect(jsonPath("$.lives").value(0))
                .andExpect(jsonPath("$.finished").value(true))
                .andExpect(jsonPath("$.result.correctAnswers").value(0))
                .andExpect(jsonPath("$.result.totalQuestions").value(10))
                .andExpect(jsonPath("$.result.perfect").value(false));
        answer(user, session, 3, List.of("x")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("quiz_session_finished"));
        assertThat(ledger(jdbc, user, "influence", WalletSource.QUIZ_REWARD)).isZero();
    }

    @Test
    void answersComeInOrderAndRetriesReturnTheStoredResult() throws Exception {
        UUID user = newUser(jdbc);
        UUID session = sessionId(start(user, "fr"));
        List<List<String>> answers = correctAnswers(session);
        answer(user, session, 1, answers.get(1)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("quiz_answer_out_of_order"));
        answer(user, session, 0, answers.get(0)).andExpect(jsonPath("$.correct").value(true));
        // A retry, even with another answer, does not regrade.
        answer(user, session, 0, List.of("other")).andExpect(status().isOk())
                .andExpect(jsonPath("$.correct").value(true))
                .andExpect(jsonPath("$.answeredCount").value(1));
    }

    @Test
    void expiredSessionsRejectAnswers() throws Exception {
        UUID user = newUser(jdbc);
        UUID session = sessionId(start(user, "fr"));
        clock.advance(Duration.ofMinutes(31));
        answer(user, session, 0, List.of("x")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("quiz_session_expired"));
    }

    @Test
    void sessionsArePrivate() throws Exception {
        UUID owner = newUser(jdbc);
        UUID other = newUser(jdbc);
        UUID session = sessionId(start(owner, "fr"));
        answer(other, session, 0, List.of("x")).andExpect(status().isNotFound());
    }

    private ResultActions start(UUID user, String language) throws Exception {
        return mockMvc.perform(post("/api/v1/quiz/sessions").with(as(user)).header("Accept-Language", language));
    }

    private ResultActions answer(UUID user, UUID session, int index, List<String> answer) throws Exception {
        String body = jsonMapper.writeValueAsString(Map.of("questionIndex", index, "answer", answer));
        return mockMvc.perform(post("/api/v1/quiz/sessions/{id}/answers", session).with(as(user))
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private static UUID sessionId(ResultActions result) throws Exception {
        return UUID.fromString(JsonPath.read(result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8), "$.id"));
    }

    /** Reads the stored answers straight from the database (never exposed by the API). */
    private List<List<String>> correctAnswers(UUID session) {
        String json = jdbc.sql("select questions::text from quiz_sessions where id = :id")
                .param("id", session).query(String.class).single();
        return JsonPath.read(json, "$[*].answer");
    }
}
