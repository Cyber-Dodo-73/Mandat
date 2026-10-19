package com.mandat.api.duel.engine;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.mandat.api.card.AbilityEffect;
import com.mandat.api.card.AbilityEffect.ConditionKind;
import com.mandat.api.card.Card;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.ArrayList;
import java.util.List;

/**
 * Resolves one duel round. Pure and deterministic, so the AI can simulate rounds with it.
 *
 * <p>Rules (both abilities are evaluated simultaneously, against the score before the round):
 * <ol>
 *   <li>Each card starts with its stat in the round's domain.</li>
 *   <li>A {@code bonus} whose condition holds adds its amount to its own card, a {@code malus} removes it
 *       from the opposing card (never below 0); either only counts when its stat is the round's domain
 *       or {@code any}.</li>
 *   <li>The higher value wins the round.</li>
 *   <li>On a tie, a card whose {@code tieBreaker} condition holds wins (if only one does); otherwise the
 *       card of lower rarity wins (the underdog); same rarity is a drawn round.</li>
 * </ol>
 */
public final class DuelEngine {

    private DuelEngine() {}

    public static RoundOutcome resolve(Card player, Card ai, Domain domain, int round, int playerWins, int aiWins) {
        int playerBase = domain.statOf(player);
        int aiBase = domain.statOf(ai);
        int playerValue = playerBase;
        int aiValue = aiBase;
        List<AppliedEffect> applied = new ArrayList<>();
        boolean playerTieBreaker = false;
        boolean aiTieBreaker = false;

        AbilityEffect playerEffect = player.getAbilityEffect();
        if (playerEffect != null && applies(playerEffect, player, ai, domain, round, playerWins < aiWins)) {
            switch (playerEffect.type()) {
                case BONUS -> {
                    if (domain.matches(playerEffect.stat())) {
                        playerValue += playerEffect.amount();
                        applied.add(AppliedEffect.of(Side.PLAYER, player, playerEffect));
                    }
                }
                case MALUS -> {
                    if (domain.matches(playerEffect.stat())) {
                        aiValue -= playerEffect.amount();
                        applied.add(AppliedEffect.of(Side.PLAYER, player, playerEffect));
                    }
                }
                case TIE_BREAKER -> playerTieBreaker = true;
            }
        }
        AbilityEffect aiEffect = ai.getAbilityEffect();
        if (aiEffect != null && applies(aiEffect, ai, player, domain, round, aiWins < playerWins)) {
            switch (aiEffect.type()) {
                case BONUS -> {
                    if (domain.matches(aiEffect.stat())) {
                        aiValue += aiEffect.amount();
                        applied.add(AppliedEffect.of(Side.AI, ai, aiEffect));
                    }
                }
                case MALUS -> {
                    if (domain.matches(aiEffect.stat())) {
                        playerValue -= aiEffect.amount();
                        applied.add(AppliedEffect.of(Side.AI, ai, aiEffect));
                    }
                }
                case TIE_BREAKER -> aiTieBreaker = true;
            }
        }
        playerValue = Math.max(0, playerValue);
        aiValue = Math.max(0, aiValue);

        Winner winner;
        TieRule tieRule = null;
        if (playerValue != aiValue) {
            winner = playerValue > aiValue ? Winner.PLAYER : Winner.AI;
        } else if (playerTieBreaker != aiTieBreaker) {
            winner = playerTieBreaker ? Winner.PLAYER : Winner.AI;
            tieRule = TieRule.TIE_BREAKER;
            AbilityEffect effect = playerTieBreaker ? playerEffect : aiEffect;
            applied.add(AppliedEffect.of(playerTieBreaker ? Side.PLAYER : Side.AI, playerTieBreaker ? player : ai, effect));
        } else if (player.getRarity() != ai.getRarity()) {
            winner = player.getRarity().compareTo(ai.getRarity()) < 0 ? Winner.PLAYER : Winner.AI;
            tieRule = TieRule.UNDERDOG;
        } else {
            winner = Winner.DRAW;
            tieRule = TieRule.DRAW;
        }
        return new RoundOutcome(domain, round, player.getId(), playerBase, playerValue, ai.getId(), aiBase, aiValue,
                List.copyOf(applied), winner, tieRule);
    }

    /** Whether an effect's condition holds for {@code self} facing {@code opponent}. */
    public static boolean applies(
            AbilityEffect effect, Card self, Card opponent, Domain domain, int round, boolean selfBehind) {
        ConditionKind kind = effect.conditionKind();
        String value = effect.conditionValue();
        return switch (kind) {
            case ALWAYS -> true;
            case OPPONENT_CONTINENT -> "same".equals(value) == (self.getContinent() == opponent.getContinent());
            case OPPONENT_ERA -> opponent.getEra() != null && opponent.getEra().key().equals(value);
            case ROUND_DOMAIN -> domain.key().equals(value);
            case ROUND -> String.valueOf(round).equals(value);
            case BEHIND -> selfBehind;
            case OPPONENT_RARITY_HIGHER -> opponent.getRarity().compareTo(self.getRarity()) > 0;
        };
    }

    public enum Side {
        PLAYER,
        AI;

        @JsonValue
        public String key() {
            return name().toLowerCase();
        }

        @JsonCreator
        public static Side fromKey(String key) {
            return valueOf(key.toUpperCase());
        }
    }

    public enum Winner {
        PLAYER,
        AI,
        DRAW;

        @JsonValue
        public String key() {
            return name().toLowerCase();
        }

        @JsonCreator
        public static Winner fromKey(String key) {
            return valueOf(key.toUpperCase());
        }
    }

    /** How a tie on values was settled. */
    public enum TieRule {
        TIE_BREAKER("tieBreaker"),
        UNDERDOG("underdog"),
        DRAW("draw");

        private final String key;

        TieRule(String key) {
            this.key = key;
        }

        @JsonValue
        public String key() {
            return key;
        }

        @JsonCreator
        public static TieRule fromKey(String key) {
            for (TieRule rule : values()) {
                if (rule.key.equals(key)) {
                    return rule;
                }
            }
            throw new IllegalArgumentException("Unknown tie rule: " + key);
        }
    }

    public record AppliedEffect(
            Side side,
            String cardId,
            AbilityEffect.Type type,
            AbilityEffect.Stat stat,
            Integer amount,
            ConditionKind condition) {

        static AppliedEffect of(Side side, Card card, AbilityEffect effect) {
            return new AppliedEffect(side, card.getId(), effect.type(), effect.stat(), effect.amount(), effect.conditionKind());
        }
    }

    public record RoundOutcome(
            Domain domain,
            int round,
            String playerCardId,
            int playerBase,
            int playerValue,
            String aiCardId,
            int aiBase,
            int aiValue,
            List<AppliedEffect> effects,
            Winner winner,
            @Schema(nullable = true, description = "How a tie on values was settled; null when values differ")
            TieRule tieRule) {}
}
