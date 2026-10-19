package com.mandat.api.quiz;

import com.mandat.api.common.config.OpenApiConfig;
import com.mandat.api.common.security.AuthenticatedUser;
import com.mandat.api.quiz.dto.QuizDtos.AnswerRequest;
import com.mandat.api.quiz.dto.QuizDtos.AnswerResponse;
import com.mandat.api.quiz.dto.QuizDtos.QuizSessionResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/quiz/sessions")
@Tag(name = "Quiz")
@SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
public class QuizController {

    private final QuizService quizService;

    public QuizController(QuizService quizService) {
        this.quizService = quizService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
            summary = "Start a 10-question quiz",
            description = "Questions are generated from the card catalog in the Accept-Language language (fr or en); "
                    + "answers are only revealed after each question is answered.")
    public QuizSessionResponse start(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestHeader(name = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acceptLanguage) {
        return quizService.start(user.id(), language(acceptLanguage));
    }

    @GetMapping("/{sessionId}")
    @Operation(summary = "Resume a quiz session (still without answers)")
    public QuizSessionResponse get(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID sessionId) {
        return quizService.get(user.id(), sessionId);
    }

    @PostMapping("/{sessionId}/answers")
    @Operation(
            summary = "Answer the next question",
            description = "Answers come in order. Re-sending an already answered question returns the stored result.")
    public AnswerResponse answer(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable UUID sessionId,
            @Valid @RequestBody AnswerRequest request) {
        return quizService.answer(user.id(), sessionId, request.questionIndex(), request.answer());
    }

    static String language(String acceptLanguage) {
        return acceptLanguage != null && acceptLanguage.trim().toLowerCase(Locale.ROOT).startsWith("en") ? "en" : "fr";
    }
}
