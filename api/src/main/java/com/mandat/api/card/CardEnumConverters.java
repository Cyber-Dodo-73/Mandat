package com.mandat.api.card;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** Stores the catalog enums with their lowercase API keys, so SQL and JSON use the same values. */
public final class CardEnumConverters {

    private CardEnumConverters() {}

    @Converter(autoApply = true)
    public static class RarityConverter implements AttributeConverter<Rarity, String> {
        @Override
        public String convertToDatabaseColumn(Rarity value) {
            return value == null ? null : value.key();
        }

        @Override
        public Rarity convertToEntityAttribute(String key) {
            return key == null ? null : Rarity.fromKey(key);
        }
    }

    @Converter(autoApply = true)
    public static class FinishConverter implements AttributeConverter<CardFinish, String> {
        @Override
        public String convertToDatabaseColumn(CardFinish value) {
            return value == null ? null : value.key();
        }

        @Override
        public CardFinish convertToEntityAttribute(String key) {
            return key == null ? null : CardFinish.fromKey(key);
        }
    }

    @Converter(autoApply = true)
    public static class ContinentConverter implements AttributeConverter<Continent, String> {
        @Override
        public String convertToDatabaseColumn(Continent value) {
            return value == null ? null : value.key();
        }

        @Override
        public Continent convertToEntityAttribute(String key) {
            return key == null ? null : Continent.fromKey(key);
        }
    }

    @Converter(autoApply = true)
    public static class EraConverter implements AttributeConverter<Era, String> {
        @Override
        public String convertToDatabaseColumn(Era value) {
            return value == null ? null : value.key();
        }

        @Override
        public Era convertToEntityAttribute(String key) {
            return key == null ? null : Era.fromKey(key);
        }
    }
}
