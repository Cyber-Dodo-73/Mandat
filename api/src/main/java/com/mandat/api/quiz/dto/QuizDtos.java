package com.mandat.api.quiz.dto;

import com.mandat.api.quiz.QuizQuestion;
import com.mandat.api.quiz.QuizQuestion.Type;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class QuizDtos {

    private QuizDtos() {}

    /** A question as sent before it is answered: never carries the answer. */
    public record QuestionDto(
            int index,
            Type type,
            String prompt,
            @Schema(nullable = true, description = "Extra text, e.g. a bio with the name masked") String text,
            List<OptionDto> options) {

        public static QuestionDto of(int index, QuizQuestion question) {
            return new QuestionDto(index, question.type(), question.prompt(), question.text(),
                    question.options().stream().map(o -> new OptionDto(o.id(), o.label(), o.cardId())).toList());
        }
    }

    public record OptionDto(
            @Schema(description = "Value to send back: a card id, or an ISO country code") String id,
            String label,
            @Schema(nullable = true, description = "Card shown with the option, when it is a figure") String cardId) {}

    public record QuizSessionResponse(
            UUID id,
            @Schema(allowableValues = {"active", "completed", "expired"}) String status,
            int totalQuestions,
            int lives,
            int answeredCount,
            int correctCount,
            Instant expiresAt,
            List<QuestionDto> questions,
            @Schema(nullable = true) QuizResultDto result) {}

    public record AnswerRequest(
            @Min(0) @Max(9) int questionIndex,
            @Schema(description = "The chosen option id, or every option id in order for chronology questions")
            @NotEmpty @Size(max = 4) List<String> answer) {}

    public record AnswerResponse(
            int questionIndex,
            boolean correct,
            List<String> correctAnswer,
            String explanation,
            int lives,
            int answeredCount,
            int correctCount,
            boolean finished,
            @Schema(nullable = true, description = "Set once the session is over") QuizResultDto result) {}

    public record QuizResultDto(
            int correctAnswers,
            int totalQuestions,
            boolean perfect,
            int influence,
            @Schema(description = "True when this quiz earned a bonus booster (every 5 perfect quizzes)") boolean bonusPack,
            @Schema(description = "True when the daily reward cap was already reached: no Influence nor booster progress")
                    boolean rewardCapped) {}
}
