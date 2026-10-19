package com.mandat.api.duel.engine;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.mandat.api.card.Card;
import com.mandat.api.duel.engine.DuelEngine.RoundOutcome;
import com.mandat.api.duel.engine.DuelEngine.Winner;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.random.RandomGenerator;

/**
 * The duel opponent. It only uses public information: the cards both sides still hold and the
 * announced domain, never the card the player is about to play.
 */
public final class DuelAi {

    /** How many closest candidates the team is drawn from: wider = more varied, less tuned. */
    private static final int TEAM_WINDOW = 12;

    private DuelAi() {}

    public enum Difficulty {
        EASY(-4),
        NORMAL(0),
        HARD(2);

        /** Offset of the AI team's average stat total from the player's. */
        private final int totalOffset;

        Difficulty(int totalOffset) {
            this.totalOffset = totalOffset;
        }

        @JsonValue
        public String key() {
            return name().toLowerCase();
        }

        @JsonCreator
        public static Difficulty fromKey(String key) {
            return Arrays.stream(values()).filter(d -> d.key().equals(key)).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Unknown difficulty: " + key));
        }
    }

    /**
     * Picks 3 cards whose stat totals sit around the player's average (lower on easy, higher on hard),
     * never one of the player's cards.
     */
    public static List<Card> pickTeam(Difficulty difficulty, List<Card> playerTeam, List<Card> pool, RandomGenerator random) {
        double target = playerTeam.stream().mapToInt(Domain::total).average().orElse(20) + difficulty.totalOffset;
        Set<String> excluded = new HashSet<>();
        playerTeam.forEach(card -> excluded.add(card.getId()));
        List<Card> candidates = new ArrayList<>(pool.stream()
                .filter(card -> !excluded.contains(card.getId()))
                .sorted(Comparator.comparingDouble((Card card) -> Math.abs(Domain.total(card) - target))
                        .thenComparing(Card::getId))
                .limit(TEAM_WINDOW)
                .toList());
        if (candidates.size() < 3) {
            throw new IllegalStateException("Card pool too small for a duel");
        }
        List<Card> team = new ArrayList<>(3);
        for (int i = 0; i < 3; i++) {
            team.add(candidates.remove(random.nextInt(candidates.size())));
        }
        return team;
    }

    /** The AI's card for this round, chosen among its remaining cards. */
    public static Card chooseCard(
            Difficulty difficulty,
            List<Card> aiHand,
            List<Card> playerHand,
            Domain domain,
            int round,
            int playerWins,
            int aiWins,
            RandomGenerator random) {
        return switch (difficulty) {
            case EASY -> aiHand.get(random.nextInt(aiHand.size()));
            case NORMAL -> aiHand.stream()
                    .max(Comparator.comparingInt(domain::statOf)
                            .thenComparing(Comparator.comparingInt(Domain::total).reversed())
                            .thenComparing(Card::getId))
                    .orElseThrow();
            case HARD -> aiHand.stream()
                    .max(Comparator.comparingDouble((Card card) ->
                                    expectedScore(card, playerHand, domain, round, playerWins, aiWins))
                            .thenComparing(Comparator.comparingInt(Domain::total).reversed())
                            .thenComparing(Card::getId))
                    .orElseThrow();
        };
    }

    /**
     * Average outcome of playing {@code aiCard} against each card the player may play (1 win, ½ draw,
     * 0 loss), abilities included. Ties go to the weaker card, which keeps strong cards for later rounds.
     */
    static double expectedScore(Card aiCard, List<Card> playerHand, Domain domain, int round, int playerWins, int aiWins) {
        double sum = 0;
        for (Card playerCard : playerHand) {
            RoundOutcome outcome = DuelEngine.resolve(playerCard, aiCard, domain, round, playerWins, aiWins);
            sum += outcome.winner() == Winner.AI ? 1 : outcome.winner() == Winner.DRAW ? 0.5 : 0;
        }
        return playerHand.isEmpty() ? 0 : sum / playerHand.size();
    }
}
