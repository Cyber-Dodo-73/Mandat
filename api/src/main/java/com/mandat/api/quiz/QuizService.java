package com.mandat.api.quiz;

import com.mandat.api.card.Card;
import com.mandat.api.card.CardCatalogService;
import com.mandat.api.card.CatalogProperties;
import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.common.events.QuizCompletedEvent;
import com.mandat.api.common.wallet.WalletService;
import com.mandat.api.common.wallet.WalletSource;
import com.mandat.api.economy.DailyRewardLimits;
import com.mandat.api.quiz.dto.QuizDtos.AnswerResponse;
import com.mandat.api.quiz.dto.QuizDtos.QuestionDto;
import com.mandat.api.quiz.dto.QuizDtos.QuizResultDto;
import com.mandat.api.quiz.dto.QuizDtos.QuizSessionResponse;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.random.RandomGenerator;
import java.util.stream.IntStream;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Quiz sessions: generated and graded server-side. Answers are stored with the session and only
 * revealed question by question, after the player answered.
 */
@Service
public class QuizService {

    private static final TypeReference<List<QuizQuestion>> QUESTIONS = new TypeReference<>() {};

    private final JdbcClient jdbc;
    private final CardCatalogService catalog;
    private final CatalogProperties catalogProperties;
    private final WalletService wallet;
    private final ApplicationEventPublisher events;
    private final RandomGenerator random;
    private final JsonMapper jsonMapper;
    private final Clock clock;
    private final DailyRewardLimits dailyLimits;

    public QuizService(
            JdbcClient jdbc,
            CardCatalogService catalog,
            CatalogProperties catalogProperties,
            WalletService wallet,
            ApplicationEventPublisher events,
            RandomGenerator random,
            JsonMapper jsonMapper,
            Clock clock,
            DailyRewardLimits dailyLimits) {
        this.jdbc = jdbc;
        this.catalog = catalog;
        this.catalogProperties = catalogProperties;
        this.wallet = wallet;
        this.events = events;
        this.random = random;
        this.jsonMapper = jsonMapper;
        this.clock = clock;
        this.dailyLimits = dailyLimits;
    }

    @Transactional
    public QuizSessionResponse start(UUID userId, String language) {
        List<Card> owned = jdbc.sql("select distinct card_id from collection_items where user_id = :userId")
                .param("userId", userId)
                .query(String.class)
                .list()
                .stream()
                .map(catalog::find)
                .flatMap(Optional::stream)
                .toList();
        List<Card> pool = catalog.activeCards(catalogProperties.season());
        List<QuizQuestion> questions = new QuizGenerator(language, random).generate(owned, pool, QuizRules.QUESTIONS);

        UUID id = UUID.randomUUID();
        Instant now = clock.instant();
        jdbc.sql("""
                        insert into quiz_sessions (id, user_id, language, questions, status, lives, created_at, expires_at)
                        values (:id, :userId, :language, cast(:questions as jsonb), 'active', :lives, :now, :expiresAt)
                        """)
                .param("id", id)
                .param("userId", userId)
                .param("language", "en".equals(language) ? "en" : "fr")
                .param("questions", jsonMapper.writeValueAsString(questions))
                .param("lives", QuizRules.LIVES)
                .param("now", Timestamp.from(now))
                .param("expiresAt", Timestamp.from(now.plus(QuizRules.SESSION_TTL)))
                .update();
        return response(session(userId, id, false));
    }

    @Transactional(readOnly = true)
    public QuizSessionResponse get(UUID userId, UUID sessionId) {
        return response(session(userId, sessionId, false));
    }

    /**
     * Grades one answer. Answers must come in order; re-sending an already answered question returns
     * the stored result unchanged (safe to retry).
     */
    @Transactional
    public AnswerResponse answer(UUID userId, UUID sessionId, int questionIndex, List<String> answer) {
        Session session = session(userId, sessionId, true);
        if (questionIndex < session.answeredCount()) {
            return replay(session, questionIndex);
        }
        if (!"active".equals(session.status())) {
            throw new ApiException(ErrorCode.QUIZ_SESSION_FINISHED, "This quiz is over");
        }
        Instant now = clock.instant();
        if (now.isAfter(session.expiresAt())) {
            jdbc.sql("update quiz_sessions set status = 'expired' where id = :id").param("id", sessionId).update();
            throw new ApiException(ErrorCode.QUIZ_SESSION_EXPIRED, "This quiz has expired");
        }
        if (questionIndex != session.answeredCount()) {
            throw new ApiException(ErrorCode.QUIZ_ANSWER_OUT_OF_ORDER, "Answer question " + session.answeredCount() + " first");
        }

        QuizQuestion question = session.questions().get(questionIndex);
        boolean correct = question.isCorrect(answer);
        jdbc.sql("""
                        insert into quiz_answers (session_id, question_index, answer, correct, answered_at)
                        values (:id, :index, cast(:answer as jsonb), :correct, :now)
                        """)
                .param("id", sessionId)
                .param("index", questionIndex)
                .param("answer", jsonMapper.writeValueAsString(answer))
                .param("correct", correct)
                .param("now", Timestamp.from(now))
                .update();

        int answered = session.answeredCount() + 1;
        int correctCount = session.correctCount() + (correct ? 1 : 0);
        int lives = session.lives() - (correct ? 0 : 1);
        boolean finished = answered == session.questions().size() || lives == 0;
        QuizResultDto result = null;
        if (finished) {
            result = complete(userId, sessionId, correctCount, session.questions().size(), now);
        }
        jdbc.sql("""
                        update quiz_sessions set answered_count = :answered, correct_count = :correct, lives = :lives,
                            status = :status, completed_at = :completedAt where id = :id
                        """)
                .param("answered", answered)
                .param("correct", correctCount)
                .param("lives", lives)
                .param("status", finished ? "completed" : "active")
                .param("completedAt", finished ? Timestamp.from(now) : null)
                .param("id", sessionId)
                .update();
        return new AnswerResponse(questionIndex, correct, question.answer(), question.explanation(), lives, answered,
                correctCount, finished, result);
    }

    private QuizResultDto complete(UUID userId, UUID sessionId, int correct, int total, Instant now) {
        boolean perfect = correct == total;
        // Daily cap (RewardLimits): beyond it the quiz still counts for XP, not for Influence nor the booster.
        boolean rewarded = dailyLimits.quizRewardAvailable(userId, now);
        int influence = rewarded ? QuizRules.influence(correct, perfect) : 0;
        if (influence > 0) {
            wallet.addInfluence(userId, influence, WalletSource.QUIZ_REWARD);
        }
        boolean bonusPack = false;
        if (perfect && rewarded) {
            int perfectCount = jdbc.sql("""
                            insert into quiz_player_stats (user_id, perfect_count) values (:userId, 1)
                            on conflict (user_id) do update set perfect_count = quiz_player_stats.perfect_count + 1
                            returning perfect_count
                            """)
                    .param("userId", userId)
                    .query(Integer.class)
                    .single();
            if (perfectCount % QuizRules.PERFECT_QUIZZES_PER_BOOSTER == 0) {
                wallet.addBonusPacks(userId, 1, WalletSource.QUIZ_REWARD);
                bonusPack = true;
            }
        }
        jdbc.sql("""
                        update quiz_sessions set reward_influence = :influence, reward_bonus_pack = :bonusPack,
                            rewarded = :rewarded
                        where id = :id
                        """)
                .param("influence", influence)
                .param("bonusPack", bonusPack)
                .param("rewarded", rewarded)
                .param("id", sessionId)
                .update();
        events.publishEvent(new QuizCompletedEvent(userId, sessionId, correct, total, now));
        return new QuizResultDto(correct, total, perfect, influence, bonusPack, !rewarded);
    }

    private AnswerResponse replay(Session session, int questionIndex) {
        QuizQuestion question = session.questions().get(questionIndex);
        boolean correct = jdbc.sql("select correct from quiz_answers where session_id = :id and question_index = :index")
                .param("id", session.id())
                .param("index", questionIndex)
                .query(Boolean.class)
                .single();
        return new AnswerResponse(questionIndex, correct, question.answer(), question.explanation(), session.lives(),
                session.answeredCount(), session.correctCount(), "completed".equals(session.status()),
                result(session));
    }

    private QuizSessionResponse response(Session session) {
        List<QuestionDto> questions = IntStream.range(0, session.questions().size())
                .mapToObj(i -> QuestionDto.of(i, session.questions().get(i)))
                .toList();
        return new QuizSessionResponse(session.id(), session.status(), session.questions().size(), session.lives(),
                session.answeredCount(), session.correctCount(), session.expiresAt(), questions, result(session));
    }

    private static QuizResultDto result(Session session) {
        if (!"completed".equals(session.status()) || session.rewardInfluence() == null) {
            return null;
        }
        int total = session.questions().size();
        return new QuizResultDto(session.correctCount(), total, session.correctCount() == total,
                session.rewardInfluence(), Boolean.TRUE.equals(session.rewardBonusPack()), !session.rewarded());
    }

    private Session session(UUID userId, UUID sessionId, boolean forUpdate) {
        return jdbc.sql("""
                        select id, status, lives, answered_count, correct_count, expires_at, questions::text as questions,
                            reward_influence, reward_bonus_pack, rewarded
                        from quiz_sessions where id = :id and user_id = :userId
                        """ + (forUpdate ? " for update" : ""))
                .param("id", sessionId)
                .param("userId", userId)
                .query(this::row)
                .optional()
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "Unknown quiz session"));
    }

    private Session row(ResultSet rs, int rowNum) throws SQLException {
        int rewardInfluence = rs.getInt("reward_influence");
        Integer influence = rs.wasNull() ? null : rewardInfluence;
        boolean bonus = rs.getBoolean("reward_bonus_pack");
        Boolean bonusPack = rs.wasNull() ? null : bonus;
        return new Session(
                rs.getObject("id", UUID.class),
                rs.getString("status"),
                rs.getInt("lives"),
                rs.getInt("answered_count"),
                rs.getInt("correct_count"),
                rs.getTimestamp("expires_at").toInstant(),
                jsonMapper.readValue(rs.getString("questions"), QUESTIONS),
                influence,
                bonusPack,
                rs.getBoolean("rewarded"));
    }

    private record Session(
            UUID id,
            String status,
            int lives,
            int answeredCount,
            int correctCount,
            Instant expiresAt,
            List<QuizQuestion> questions,
            Integer rewardInfluence,
            Boolean rewardBonusPack,
            boolean rewarded) {}
}
