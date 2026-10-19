package com.mandat.api.quiz;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import java.util.Arrays;
import java.util.List;

/**
 * A generated question, stored server-side with its answer. Before the player answers, only the type,
 * prompt, text and options are sent (see {@code QuizDtos.QuestionDto}).
 *
 * @param text        extra text shown with the prompt (a bio with the name masked), or null
 * @param answer      the correct option id, or the option ids in order for {@link Type#CHRONOLOGY}
 * @param explanation shown after answering
 */
public record QuizQuestion(
        Type type,
        String prompt,
        String text,
        List<Option> options,
        List<String> answer,
        String explanation,
        String subjectCardId) {

    public enum Type {
        WHO_ROLE("whoRole"),
        WHO_BIO("whoBio"),
        WHICH_COUNTRY("whichCountry"),
        OLDEST("oldest"),
        CHRONOLOGY("chronology");

        private final String key;

        Type(String key) {
            this.key = key;
        }

        @JsonValue
        public String key() {
            return key;
        }

        @JsonCreator
        public static Type fromKey(String key) {
            return Arrays.stream(values()).filter(t -> t.key.equals(key)).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Unknown question type: " + key));
        }
    }

    /** {@code id} is a card id, or an ISO country code for {@link Type#WHICH_COUNTRY}. */
    public record Option(String id, String label, String cardId) {}

    public boolean isCorrect(List<String> given) {
        return given != null && given.equals(answer);
    }
}
