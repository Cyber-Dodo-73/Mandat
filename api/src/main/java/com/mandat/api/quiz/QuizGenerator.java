package com.mandat.api.quiz;

import com.mandat.api.card.Card;
import com.mandat.api.quiz.QuizQuestion.Option;
import com.mandat.api.quiz.QuizQuestion.Type;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Predicate;
import java.util.random.RandomGenerator;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Builds quiz questions from catalog data only (names, roles, bios, countries, birth years), so every
 * answer is checkable against the catalog. Pure: the randomness comes from the caller.
 */
public final class QuizGenerator {

    static final int OPTIONS = 4;
    private static final String MASK = "…";
    /** Name particles that stay visible in masked bios ("de", "von"…): masking them would garble the text. */
    private static final Set<String> PARTICLES = Set.of(
            "de", "du", "des", "la", "le", "les", "von", "van", "der", "den", "al", "el", "ibn", "bin", "ben",
            "of", "the", "and", "et", "y", "da", "di", "dos", "das");
    private static final Pattern WORD_SPLIT = Pattern.compile("[^\\p{L}\\p{N}]+");

    private final String language;
    private final Locale locale;
    private final RandomGenerator random;

    public QuizGenerator(String language, RandomGenerator random) {
        this.language = "en".equals(language) ? "en" : "fr";
        this.locale = "en".equals(this.language) ? Locale.ENGLISH : Locale.FRENCH;
        this.random = random;
    }

    /**
     * {@code count} questions about distinct figures; about half of them on cards the player owns when
     * possible, the rest from the whole pool.
     */
    public List<QuizQuestion> generate(List<Card> owned, List<Card> pool, int count) {
        List<Card> subjects = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        List<Card> ownedShuffled = shuffled(owned);
        for (Card card : ownedShuffled) {
            if (subjects.size() >= count / 2) {
                break;
            }
            if (seen.add(card.getId())) {
                subjects.add(card);
            }
        }
        for (Card card : shuffled(pool)) {
            if (seen.add(card.getId())) {
                subjects.add(card);
            }
        }

        List<Type> plan = new ArrayList<>();
        while (plan.size() < count) {
            List<Type> round = new ArrayList<>(List.of(Type.values()));
            shuffle(round);
            plan.addAll(round);
        }

        List<QuizQuestion> questions = new ArrayList<>(count);
        int next = 0;
        for (int i = 0; i < count && next < subjects.size(); i++) {
            Type planned = plan.get(i);
            QuizQuestion question = null;
            while (question == null && next < subjects.size()) {
                Card subject = subjects.get(next++);
                question = build(planned, subject, pool);
                for (Type fallback : Type.values()) {
                    if (question == null && fallback != planned) {
                        question = build(fallback, subject, pool);
                    }
                }
            }
            if (question != null) {
                questions.add(question);
            }
        }
        if (questions.size() < count) {
            throw new IllegalStateException("Card pool too small for a quiz");
        }
        return questions;
    }

    Optional<QuizQuestion> question(Type type, Card subject, List<Card> pool) {
        return Optional.ofNullable(build(type, subject, pool));
    }

    private QuizQuestion build(Type type, Card subject, List<Card> pool) {
        return switch (type) {
            case WHO_ROLE -> whoRole(subject, pool);
            case WHO_BIO -> whoBio(subject, pool);
            case WHICH_COUNTRY -> whichCountry(subject, pool);
            case OLDEST -> oldest(subject, pool);
            case CHRONOLOGY -> chronology(subject, pool);
        };
    }

    private QuizQuestion whoRole(Card subject, List<Card> pool) {
        String role = role(subject);
        List<Card> others = pick(pool, subject, card -> !role(card).equalsIgnoreCase(role)
                && !name(card).equalsIgnoreCase(name(subject)), OPTIONS - 1);
        if (others == null) {
            return null;
        }
        String prompt = fr() ? "Qui a été « " + role + " » ?" : "Who was “" + role + "”?";
        return nameQuestion(Type.WHO_ROLE, prompt, null, subject, others);
    }

    private QuizQuestion whoBio(Card subject, List<Card> pool) {
        String bio = fr() ? subject.getBioFr() : subject.getBioEn();
        if (bio == null || bio.isBlank()) {
            return null;
        }
        String masked = mask(bio, subject);
        List<Card> others = pick(pool, subject, card -> !name(card).equalsIgnoreCase(name(subject)), OPTIONS - 1);
        if (others == null) {
            return null;
        }
        return nameQuestion(Type.WHO_BIO, fr() ? "Qui est décrit ici ?" : "Who is described here?", masked, subject, others);
    }

    private QuizQuestion whichCountry(Card subject, List<Card> pool) {
        String country = subject.getCountry();
        String label = countryLabel(country);
        if (label == null) {
            return null;
        }
        Map<String, String> distractors = new LinkedHashMap<>();
        for (Card card : shuffled(pool)) {
            String code = card.getCountry();
            String codeLabel = countryLabel(code);
            if (code != null && !code.equals(country) && codeLabel != null && !codeLabel.equals(label)) {
                distractors.putIfAbsent(code, codeLabel);
            }
            if (distractors.size() == OPTIONS - 1) {
                break;
            }
        }
        if (distractors.size() < OPTIONS - 1) {
            return null;
        }
        List<Option> options = new ArrayList<>();
        options.add(new Option(country, label, null));
        distractors.forEach((code, codeLabel) -> options.add(new Option(code, codeLabel, null)));
        shuffle(options);
        String prompt = fr() ? "De quel pays vient " + name(subject) + " ?" : "Which country is " + name(subject) + " from?";
        return new QuizQuestion(Type.WHICH_COUNTRY, prompt, null, List.copyOf(options), List.of(country),
                name(subject) + " — " + label, subject.getId());
    }

    private QuizQuestion oldest(Card subject, List<Card> pool) {
        List<Card> group = datedGroup(subject, pool);
        if (group == null) {
            return null;
        }
        Card first = group.stream().min(Comparator.comparingInt(Card::getBirthYear)).orElseThrow();
        List<Option> options = group.stream().map(this::nameOption).collect(Collectors.toCollection(ArrayList::new));
        shuffle(options);
        return new QuizQuestion(Type.OLDEST, fr() ? "Qui est né le plus tôt ?" : "Who was born first?", null,
                List.copyOf(options), List.of(first.getId()), datedExplanation(group), subject.getId());
    }

    private QuizQuestion chronology(Card subject, List<Card> pool) {
        List<Card> group = datedGroup(subject, pool);
        if (group == null) {
            return null;
        }
        List<String> order = group.stream()
                .sorted(Comparator.comparingInt(Card::getBirthYear))
                .map(Card::getId)
                .toList();
        List<Option> options = group.stream().map(this::nameOption).collect(Collectors.toCollection(ArrayList::new));
        shuffle(options);
        String prompt = fr()
                ? "Classe ces figures de la plus ancienne à la plus récente (par date de naissance)."
                : "Order these figures from earliest to latest (by birth).";
        return new QuizQuestion(Type.CHRONOLOGY, prompt, null, List.copyOf(options), order, datedExplanation(group),
                subject.getId());
    }

    /** The subject and 3 others, all with a known and different birth year. */
    private List<Card> datedGroup(Card subject, List<Card> pool) {
        if (subject.getBirthYear() == null) {
            return null;
        }
        Set<Integer> years = new HashSet<>(Set.of(subject.getBirthYear()));
        List<Card> group = new ArrayList<>(List.of(subject));
        for (Card card : shuffled(pool)) {
            if (group.size() == OPTIONS) {
                break;
            }
            if (!card.getId().equals(subject.getId()) && card.getBirthYear() != null && years.add(card.getBirthYear())) {
                group.add(card);
            }
        }
        return group.size() == OPTIONS ? group : null;
    }

    private String datedExplanation(List<Card> group) {
        return group.stream()
                .sorted(Comparator.comparingInt(Card::getBirthYear))
                .map(card -> name(card) + " (" + year(card.getBirthYear()) + ")")
                .collect(Collectors.joining(" · "));
    }

    private String year(int year) {
        if (year >= 0) {
            return String.valueOf(year);
        }
        return fr() ? -year + " av. J.-C." : -year + " BC";
    }

    private QuizQuestion nameQuestion(Type type, String prompt, String text, Card subject, List<Card> others) {
        List<Option> options = new ArrayList<>();
        options.add(nameOption(subject));
        others.forEach(card -> options.add(nameOption(card)));
        shuffle(options);
        return new QuizQuestion(type, prompt, text, List.copyOf(options), List.of(subject.getId()),
                name(subject) + " — " + role(subject), subject.getId());
    }

    private Option nameOption(Card card) {
        return new Option(card.getId(), name(card), card.getId());
    }

    /** Hides every significant word of the figure's name, so the bio doesn't give the answer away. */
    String mask(String bio, Card subject) {
        String masked = bio;
        Set<String> words = new HashSet<>();
        for (String name : List.of(subject.getNameFr(), subject.getNameEn())) {
            for (String word : WORD_SPLIT.split(name)) {
                if (word.length() >= 3 && !PARTICLES.contains(word.toLowerCase(Locale.ROOT))) {
                    words.add(word);
                }
            }
        }
        for (String word : words) {
            masked = Pattern.compile("(?<![\\p{L}\\p{N}])" + Pattern.quote(word) + "(?![\\p{L}\\p{N}])",
                            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE)
                    .matcher(masked)
                    .replaceAll(MASK);
        }
        return masked;
    }

    private String countryLabel(String code) {
        if (code == null || code.length() != 2) {
            return null;
        }
        String label = Locale.of("", code).getDisplayCountry(locale);
        return label.isBlank() || label.equalsIgnoreCase(code) ? null : label;
    }

    private List<Card> pick(List<Card> pool, Card subject, Predicate<Card> accept, int n) {
        List<Card> picked = new ArrayList<>(n);
        Set<String> labels = new HashSet<>(Set.of(name(subject).toLowerCase(Locale.ROOT)));
        for (Card card : shuffled(pool)) {
            if (picked.size() == n) {
                break;
            }
            if (!card.getId().equals(subject.getId()) && accept.test(card) && labels.add(name(card).toLowerCase(Locale.ROOT))) {
                picked.add(card);
            }
        }
        return picked.size() == n ? picked : null;
    }

    private boolean fr() {
        return "fr".equals(language);
    }

    private String name(Card card) {
        return fr() ? card.getNameFr() : card.getNameEn();
    }

    private String role(Card card) {
        return fr() ? card.getRoleFr() : card.getRoleEn();
    }

    private <T> List<T> shuffled(List<T> items) {
        List<T> copy = new ArrayList<>(items);
        shuffle(copy);
        return copy;
    }

    /** Fisher–Yates with the injected generator (Collections.shuffle needs a java.util.Random). */
    private <T> void shuffle(List<T> items) {
        for (int i = items.size() - 1; i > 0; i--) {
            Collections.swap(items, i, random.nextInt(i + 1));
        }
    }
}
