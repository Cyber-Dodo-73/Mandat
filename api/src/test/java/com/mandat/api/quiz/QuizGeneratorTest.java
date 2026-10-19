package com.mandat.api.quiz;

import static com.mandat.api.support.TestCards.card;
import static org.assertj.core.api.Assertions.assertThat;

import com.mandat.api.card.Card;
import com.mandat.api.quiz.QuizQuestion.Option;
import com.mandat.api.quiz.QuizQuestion.Type;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.random.RandomGenerator;
import java.util.random.RandomGeneratorFactory;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class QuizGeneratorTest {

    static final String[] COUNTRIES = {"FR", "DE", "US", "ZA", "IN", "BR", "JP", "EG", "MX", "AU", "IT", "CN"};

    static RandomGenerator seeded(long seed) {
        return RandomGeneratorFactory.of("L64X128MixRandom").create(seed);
    }

    static List<Card> pool() {
        List<Card> cards = new ArrayList<>();
        for (int i = 0; i < 40; i++) {
            String surname = "Nom" + (char) ('A' + i % 26) + i;
            cards.add(card("q" + i)
                    .name("Prénom " + surname, "First " + surname)
                    .role(i % 5 == 0 ? "Président de la République" : "Roi " + i, i % 5 == 0 ? "President" : "King " + i)
                    .bio(surname + " a gouverné pendant dix ans. Sous son règne, " + surname + " réforma l'État.",
                            surname + " ruled for ten years. During that reign " + surname + " reformed the state.")
                    .country(COUNTRIES[i % COUNTRIES.length])
                    .born(i == 39 ? null : -500 + i * 47)
                    .build());
        }
        return cards;
    }

    @Test
    void tenQuestionsWhoseAnswersMatchTheCatalog() {
        List<Card> pool = pool();
        Map<String, Card> byId = pool.stream().collect(Collectors.toMap(Card::getId, Function.identity()));
        for (long seed = 0; seed < 50; seed++) {
            List<QuizQuestion> questions = new QuizGenerator("fr", seeded(seed)).generate(List.of(), pool, 10);
            assertThat(questions).hasSize(10);
            assertThat(questions.stream().map(QuizQuestion::subjectCardId).collect(Collectors.toSet())).hasSize(10);
            for (QuizQuestion question : questions) {
                assertThat(question.options()).hasSize(4);
                assertThat(question.options().stream().map(Option::id).collect(Collectors.toSet())).hasSize(4);
                assertConsistent(question, byId);
            }
        }
    }

    private static void assertConsistent(QuizQuestion question, Map<String, Card> byId) {
        Card subject = byId.get(question.subjectCardId());
        List<String> optionIds = question.options().stream().map(Option::id).toList();
        switch (question.type()) {
            case WHO_ROLE -> {
                assertThat(question.answer()).containsExactly(subject.getId());
                assertThat(question.prompt()).contains(subject.getRoleFr());
                // No distractor shares the role asked about.
                optionIds.stream().filter(id -> !id.equals(subject.getId()))
                        .forEach(id -> assertThat(byId.get(id).getRoleFr()).isNotEqualToIgnoringCase(subject.getRoleFr()));
            }
            case WHO_BIO -> {
                assertThat(question.answer()).containsExactly(subject.getId());
                assertThat(question.text()).doesNotContain(subject.getNameFr().split(" ")[1]);
                assertThat(question.text()).contains("…");
            }
            case WHICH_COUNTRY -> {
                assertThat(question.answer()).containsExactly(subject.getCountry());
                assertThat(optionIds).contains(subject.getCountry());
            }
            case OLDEST -> {
                Card first = optionIds.stream().map(byId::get).min(Comparator.comparingInt(Card::getBirthYear)).orElseThrow();
                assertThat(question.answer()).containsExactly(first.getId());
            }
            case CHRONOLOGY -> {
                List<String> sorted = optionIds.stream().map(byId::get)
                        .sorted(Comparator.comparingInt(Card::getBirthYear)).map(Card::getId).toList();
                assertThat(question.answer()).isEqualTo(sorted);
                assertThat(new HashSet<>(optionIds.stream().map(id -> byId.get(id).getBirthYear()).toList())).hasSize(4);
            }
        }
    }

    @Test
    void everyQuestionTypeCanBeGenerated() {
        List<Card> pool = pool();
        QuizGenerator generator = new QuizGenerator("en", seeded(3));
        for (Type type : Type.values()) {
            assertThat(generator.question(type, pool.get(1), pool)).as(type.key()).isPresent();
        }
    }

    @Test
    void figuresWithoutBirthYearAreNeverDated() {
        List<Card> pool = pool();
        QuizGenerator generator = new QuizGenerator("fr", seeded(1));
        assertThat(generator.question(Type.OLDEST, pool.get(39), pool)).isEmpty();
        assertThat(generator.question(Type.CHRONOLOGY, pool.get(39), pool)).isEmpty();
    }

    @Test
    void englishPromptsAndCountryNames() {
        List<Card> pool = pool();
        QuizQuestion question = new QuizGenerator("en", seeded(2)).question(Type.WHICH_COUNTRY, pool.get(0), pool).orElseThrow();
        assertThat(question.prompt()).startsWith("Which country is First");
        assertThat(question.options()).extracting(Option::label).contains("France");
    }

    @Test
    void prefersOwnedCardsForAboutHalfTheQuestions() {
        List<Card> pool = pool();
        List<Card> owned = pool.subList(0, 8);
        List<QuizQuestion> questions = new QuizGenerator("fr", seeded(5)).generate(owned, pool, 10);
        long aboutOwned = questions.stream()
                .filter(q -> owned.stream().anyMatch(card -> card.getId().equals(q.subjectCardId())))
                .count();
        assertThat(aboutOwned).isGreaterThanOrEqualTo(4);
    }

    @Test
    void sameSeedSameQuiz() {
        List<Card> pool = pool();
        assertThat(new QuizGenerator("fr", seeded(9)).generate(List.of(), pool, 10))
                .isEqualTo(new QuizGenerator("fr", seeded(9)).generate(List.of(), pool, 10));
    }

    @Test
    void masksAccentedAndRepeatedNames() {
        Card subject = card("m").name("Simón Bolívar", "Simón Bolívar").build();
        String masked = new QuizGenerator("fr", seeded(1))
                .mask("Simón Bolívar libère le Venezuela. Bolívar fonde la Grande-Colombie.", subject);
        assertThat(masked).doesNotContain("Bolívar").doesNotContain("Simón").contains("le Venezuela");
    }
}
