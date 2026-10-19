package com.mandat.api.duel.engine;

import static com.mandat.api.support.TestCards.card;
import static org.assertj.core.api.Assertions.assertThat;

import com.mandat.api.card.AbilityEffect;
import com.mandat.api.card.AbilityEffect.ConditionKind;
import com.mandat.api.card.AbilityEffect.Stat;
import com.mandat.api.card.AbilityEffect.Type;
import com.mandat.api.card.Card;
import com.mandat.api.card.Continent;
import com.mandat.api.card.Era;
import com.mandat.api.card.Rarity;
import com.mandat.api.duel.engine.DuelEngine.RoundOutcome;
import com.mandat.api.duel.engine.DuelEngine.Side;
import com.mandat.api.duel.engine.DuelEngine.TieRule;
import com.mandat.api.duel.engine.DuelEngine.Winner;
import org.junit.jupiter.api.Test;

class DuelEngineTest {

    static AbilityEffect bonus(Stat stat, int amount, ConditionKind kind, String value) {
        return new AbilityEffect(Type.BONUS, stat, amount, kind, value);
    }

    static AbilityEffect malus(Stat stat, int amount, ConditionKind kind, String value) {
        return new AbilityEffect(Type.MALUS, stat, amount, kind, value);
    }

    static final Card PLAIN_6 = card("plain6").stats(6, 6, 6, 6).build();

    @Test
    void higherStatInTheDomainWins() {
        Card strong = card("a").stats(1, 9, 1, 1).build();
        Card weak = card("b").stats(9, 2, 9, 9).build();
        RoundOutcome outcome = DuelEngine.resolve(strong, weak, Domain.DIPLOMACY, 1, 0, 0);
        assertThat(outcome.playerBase()).isEqualTo(9);
        assertThat(outcome.aiBase()).isEqualTo(2);
        assertThat(outcome.winner()).isEqualTo(Winner.PLAYER);
        assertThat(outcome.tieRule()).isNull();
        assertThat(outcome.effects()).isEmpty();
    }

    @Test
    void alwaysBonusAppliesOnlyInItsDomainOrAny() {
        Card diplomat = card("d").stats(5, 5, 5, 5).effect(bonus(Stat.DIPLOMACY, 1, ConditionKind.ALWAYS, null)).build();
        assertThat(DuelEngine.resolve(diplomat, PLAIN_6, Domain.DIPLOMACY, 1, 0, 0).playerValue()).isEqualTo(6);
        assertThat(DuelEngine.resolve(diplomat, PLAIN_6, Domain.STRATEGY, 1, 0, 0).playerValue()).isEqualTo(5);

        Card any = card("any").stats(5, 5, 5, 5).effect(bonus(Stat.ANY, 1, ConditionKind.ALWAYS, null)).build();
        RoundOutcome outcome = DuelEngine.resolve(any, PLAIN_6, Domain.STRATEGY, 1, 0, 0);
        assertThat(outcome.playerValue()).isEqualTo(6);
        assertThat(outcome.effects()).singleElement().satisfies(e -> {
            assertThat(e.side()).isEqualTo(Side.PLAYER);
            assertThat(e.cardId()).isEqualTo("any");
            assertThat(e.condition()).isEqualTo(ConditionKind.ALWAYS);
        });
    }

    @Test
    void opponentContinentSameAndDifferent() {
        Card same = card("s").continent(Continent.AFRICA)
                .effect(bonus(Stat.ANY, 2, ConditionKind.OPPONENT_CONTINENT, "same")).build();
        Card different = card("x").continent(Continent.AFRICA)
                .effect(bonus(Stat.ANY, 2, ConditionKind.OPPONENT_CONTINENT, "different")).build();
        Card african = card("af").continent(Continent.AFRICA).build();
        Card asian = card("as").continent(Continent.ASIA).build();
        assertThat(DuelEngine.resolve(same, african, Domain.INFLUENCE, 1, 0, 0).playerValue()).isEqualTo(7);
        assertThat(DuelEngine.resolve(same, asian, Domain.INFLUENCE, 1, 0, 0).playerValue()).isEqualTo(5);
        assertThat(DuelEngine.resolve(different, asian, Domain.INFLUENCE, 1, 0, 0).playerValue()).isEqualTo(7);
        assertThat(DuelEngine.resolve(different, african, Domain.INFLUENCE, 1, 0, 0).playerValue()).isEqualTo(5);
    }

    @Test
    void opponentEraMalus() {
        Card historian = card("h").effect(malus(Stat.STRATEGY, 2, ConditionKind.OPPONENT_ERA, "medieval")).build();
        Card medieval = card("m").era(Era.MEDIEVAL).stats(5, 5, 5, 7).build();
        Card modern = card("n").era(Era.MODERN).stats(5, 5, 5, 7).build();
        assertThat(DuelEngine.resolve(historian, medieval, Domain.STRATEGY, 1, 0, 0).aiValue()).isEqualTo(5);
        assertThat(DuelEngine.resolve(historian, modern, Domain.STRATEGY, 1, 0, 0).aiValue()).isEqualTo(7);
    }

    @Test
    void roundDomainAndRoundNumberConditions() {
        Card orator = card("o").effect(bonus(Stat.CHARISMA, 3, ConditionKind.ROUND_DOMAIN, "charisma")).build();
        assertThat(DuelEngine.resolve(orator, PLAIN_6, Domain.CHARISMA, 1, 0, 0).playerValue()).isEqualTo(8);
        assertThat(DuelEngine.resolve(orator, PLAIN_6, Domain.DIPLOMACY, 1, 0, 0).playerValue()).isEqualTo(5);

        Card closer = card("c").effect(bonus(Stat.ANY, 2, ConditionKind.ROUND, "3")).build();
        assertThat(DuelEngine.resolve(closer, PLAIN_6, Domain.INFLUENCE, 3, 1, 1).playerValue()).isEqualTo(7);
        assertThat(DuelEngine.resolve(closer, PLAIN_6, Domain.INFLUENCE, 2, 1, 0).playerValue()).isEqualTo(5);
    }

    @Test
    void behindIsEvaluatedFromEachSidesPointOfView() {
        Card comeback = card("cb").effect(bonus(Stat.ANY, 2, ConditionKind.BEHIND, null)).build();
        // Player plays the comeback card while losing 0–1.
        assertThat(DuelEngine.resolve(comeback, PLAIN_6, Domain.INFLUENCE, 2, 0, 1).playerValue()).isEqualTo(7);
        assertThat(DuelEngine.resolve(comeback, PLAIN_6, Domain.INFLUENCE, 2, 1, 0).playerValue()).isEqualTo(5);
        // AI plays it while losing 0–1.
        assertThat(DuelEngine.resolve(PLAIN_6, comeback, Domain.INFLUENCE, 2, 1, 0).aiValue()).isEqualTo(7);
    }

    @Test
    void opponentRarityHigher() {
        Card underdog = card("u").rarity(Rarity.COMMON)
                .effect(malus(Stat.ANY, 1, ConditionKind.OPPONENT_RARITY_HIGHER, null)).build();
        Card legend = card("l").rarity(Rarity.LEGENDARY).stats(6, 6, 6, 6).build();
        Card common = card("k").rarity(Rarity.COMMON).stats(6, 6, 6, 6).build();
        assertThat(DuelEngine.resolve(underdog, legend, Domain.INFLUENCE, 1, 0, 0).aiValue()).isEqualTo(5);
        assertThat(DuelEngine.resolve(underdog, common, Domain.INFLUENCE, 1, 0, 0).aiValue()).isEqualTo(6);
    }

    @Test
    void malusNeverGoesBelowZero() {
        Card crusher = card("cr").effect(malus(Stat.ANY, 3, ConditionKind.ALWAYS, null)).build();
        Card tiny = card("t").stats(1, 1, 1, 1).build();
        assertThat(DuelEngine.resolve(crusher, tiny, Domain.INFLUENCE, 1, 0, 0).aiValue()).isZero();
    }

    @Test
    void tieBreakerThenUnderdogThenDraw() {
        Card tieBreaker = card("tb").effect(new AbilityEffect(Type.TIE_BREAKER, null, null, ConditionKind.ALWAYS, null)).build();
        RoundOutcome byAbility = DuelEngine.resolve(tieBreaker, card("p").build(), Domain.INFLUENCE, 1, 0, 0);
        assertThat(byAbility.winner()).isEqualTo(Winner.PLAYER);
        assertThat(byAbility.tieRule()).isEqualTo(TieRule.TIE_BREAKER);
        assertThat(byAbility.effects()).singleElement().satisfies(e -> assertThat(e.type()).isEqualTo(Type.TIE_BREAKER));

        Card rare = card("r").rarity(Rarity.RARE).build();
        RoundOutcome underdog = DuelEngine.resolve(rare, card("c").rarity(Rarity.COMMON).build(), Domain.INFLUENCE, 1, 0, 0);
        assertThat(underdog.winner()).isEqualTo(Winner.AI);
        assertThat(underdog.tieRule()).isEqualTo(TieRule.UNDERDOG);

        RoundOutcome draw = DuelEngine.resolve(card("a").build(), card("b").build(), Domain.INFLUENCE, 1, 0, 0);
        assertThat(draw.winner()).isEqualTo(Winner.DRAW);
        assertThat(draw.tieRule()).isEqualTo(TieRule.DRAW);
    }

    @Test
    void bothEffectsApplySimultaneously() {
        Card player = card("p").stats(5, 5, 5, 5).effect(bonus(Stat.ANY, 2, ConditionKind.ALWAYS, null)).build();
        Card ai = card("a").stats(6, 6, 6, 6).effect(malus(Stat.ANY, 1, ConditionKind.ALWAYS, null)).build();
        RoundOutcome outcome = DuelEngine.resolve(player, ai, Domain.STRATEGY, 1, 0, 0);
        assertThat(outcome.playerValue()).isEqualTo(6);
        assertThat(outcome.aiValue()).isEqualTo(6);
        assertThat(outcome.effects()).hasSize(2);
    }
}
