package com.mandat.api.support;

import com.mandat.api.card.AbilityEffect;
import com.mandat.api.card.Card;
import com.mandat.api.card.Continent;
import com.mandat.api.card.Era;
import com.mandat.api.card.Rarity;
import java.lang.reflect.Constructor;
import org.springframework.test.util.ReflectionTestUtils;

/** Builds catalog cards in memory for unit tests (the entity is read-only and has no public constructor). */
public final class TestCards {

    private TestCards() {}

    public static Builder card(String id) {
        return new Builder(id);
    }

    public static final class Builder {

        private final Card card;

        private Builder(String id) {
            try {
                Constructor<Card> constructor = Card.class.getDeclaredConstructor();
                constructor.setAccessible(true);
                card = constructor.newInstance();
            } catch (ReflectiveOperationException e) {
                throw new IllegalStateException(e);
            }
            set("id", id);
            set("nameFr", "Figure " + id);
            set("nameEn", "Figure " + id);
            set("roleFr", "Dirigeant " + id);
            set("roleEn", "Leader " + id);
            set("bioFr", "Bio de " + id + ".");
            set("bioEn", "Bio of " + id + ".");
            set("country", "FR");
            set("continent", Continent.EUROPE);
            set("era", Era.MODERN);
            set("rarity", Rarity.COMMON);
            set("active", true);
            stats(5, 5, 5, 5);
        }

        public Builder name(String fr, String en) {
            set("nameFr", fr);
            set("nameEn", en);
            return this;
        }

        public Builder role(String fr, String en) {
            set("roleFr", fr);
            set("roleEn", en);
            return this;
        }

        public Builder bio(String fr, String en) {
            set("bioFr", fr);
            set("bioEn", en);
            return this;
        }

        public Builder country(String iso) {
            set("country", iso);
            return this;
        }

        public Builder continent(Continent continent) {
            set("continent", continent);
            return this;
        }

        public Builder era(Era era) {
            set("era", era);
            return this;
        }

        public Builder born(Integer year) {
            set("birthYear", year);
            return this;
        }

        public Builder rarity(Rarity rarity) {
            set("rarity", rarity);
            return this;
        }

        public Builder stats(int influence, int diplomacy, int charisma, int strategy) {
            set("statInfluence", influence);
            set("statDiplomacy", diplomacy);
            set("statCharisma", charisma);
            set("statStrategy", strategy);
            return this;
        }

        public Builder effect(AbilityEffect effect) {
            set("effectType", effect.type().key());
            set("effectStat", effect.stat() == null ? null : effect.stat().key());
            set("effectAmount", effect.amount());
            set("effectCondition", effect.conditionKind().key());
            set("effectConditionValue", effect.conditionValue());
            return this;
        }

        public Card build() {
            return card;
        }

        private void set(String field, Object value) {
            ReflectionTestUtils.setField(card, field, value);
        }
    }
}
