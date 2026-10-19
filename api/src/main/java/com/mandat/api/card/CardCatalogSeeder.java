package com.mandat.api.card;

import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Timestamp;
import java.time.Clock;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.Resource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

/**
 * Loads the catalog file into the database at startup. Idempotent: the file's SHA-256 is stored in
 * {@code catalog_versions} and an unchanged file is skipped. Cards are upserted; cards missing from
 * the file are deactivated (never deleted, players may own them).
 */
@Component
public class CardCatalogSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(CardCatalogSeeder.class);

    private static final String UPSERT_CARD = """
            insert into cards (id, season, number, wikidata_id, name_fr, name_en, role_fr, role_en, country,
                continent, era, birth_year, death_year, is_living, fame_score, rarity, bio_fr, bio_en,
                stat_influence, stat_diplomacy, stat_charisma, stat_strategy, ability_name_fr, ability_name_en,
                ability_desc_fr, ability_desc_en, effect_type, effect_stat, effect_amount, effect_condition,
                effect_condition_value, sensitive, artwork, active)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true)
            on conflict (id) do update set
                season = excluded.season, number = excluded.number, wikidata_id = excluded.wikidata_id,
                name_fr = excluded.name_fr, name_en = excluded.name_en, role_fr = excluded.role_fr,
                role_en = excluded.role_en, country = excluded.country, continent = excluded.continent,
                era = excluded.era, birth_year = excluded.birth_year, death_year = excluded.death_year,
                is_living = excluded.is_living, fame_score = excluded.fame_score, rarity = excluded.rarity,
                bio_fr = excluded.bio_fr, bio_en = excluded.bio_en, stat_influence = excluded.stat_influence,
                stat_diplomacy = excluded.stat_diplomacy, stat_charisma = excluded.stat_charisma,
                stat_strategy = excluded.stat_strategy, ability_name_fr = excluded.ability_name_fr,
                ability_name_en = excluded.ability_name_en, ability_desc_fr = excluded.ability_desc_fr,
                ability_desc_en = excluded.ability_desc_en, effect_type = excluded.effect_type,
                effect_stat = excluded.effect_stat, effect_amount = excluded.effect_amount,
                effect_condition = excluded.effect_condition, effect_condition_value = excluded.effect_condition_value,
                sensitive = excluded.sensitive,
                artwork = excluded.artwork, active = true
            """;

    private final CatalogProperties properties;
    private final JsonMapper jsonMapper;
    private final JdbcTemplate jdbcTemplate;
    private final JdbcClient jdbc;
    private final TransactionTemplate transactionTemplate;
    private final CardCatalogService catalogService;
    private final Clock clock;

    public CardCatalogSeeder(
            CatalogProperties properties,
            JsonMapper jsonMapper,
            JdbcTemplate jdbcTemplate,
            JdbcClient jdbc,
            TransactionTemplate transactionTemplate,
            CardCatalogService catalogService,
            Clock clock) {
        this.properties = properties;
        this.jsonMapper = jsonMapper;
        this.jdbcTemplate = jdbcTemplate;
        this.jdbc = jdbc;
        this.transactionTemplate = transactionTemplate;
        this.catalogService = catalogService;
        this.clock = clock;
    }

    @Override
    public void run(ApplicationArguments args) throws IOException {
        Resource location = properties.location();
        if (!location.exists()) {
            log.info("Card catalog file {} not found: catalog seeding skipped", location.getDescription());
            return;
        }
        byte[] content;
        try (InputStream input = location.getInputStream()) {
            content = input.readAllBytes();
        }
        seed(content);
    }

    /** Seeds the catalog from raw file content. Returns true when the database changed. */
    public boolean seed(byte[] content) {
        String hash = sha256(content);
        CatalogFile file = jsonMapper.readValue(content, CatalogFile.class);
        Boolean changed = transactionTemplate.execute(status -> {
            Optional<String> current = jdbc.sql("select content_hash from catalog_versions where season = :season")
                    .param("season", file.season())
                    .query(String.class)
                    .optional();
            if (current.filter(hash::equals).isPresent()) {
                return false;
            }
            upsertCards(file);
            deactivateMissing(file);
            jdbc.sql("""
                            insert into catalog_versions (season, content_hash, card_count, seeded_at)
                            values (:season, :hash, :count, :now)
                            on conflict (season) do update set content_hash = excluded.content_hash,
                                card_count = excluded.card_count, seeded_at = excluded.seeded_at
                            """)
                    .param("season", file.season())
                    .param("hash", hash)
                    .param("count", file.cards().size())
                    .param("now", Timestamp.from(clock.instant()))
                    .update();
            return true;
        });
        boolean seeded = Boolean.TRUE.equals(changed);
        if (seeded) {
            catalogService.evict(file.season());
            log.info("Card catalog season {} seeded: {} cards (hash {})", file.season(), file.cards().size(), hash);
        } else {
            log.info("Card catalog season {} already up to date (hash {})", file.season(), hash);
        }
        return seeded;
    }

    private void upsertCards(CatalogFile file) {
        List<Object[]> rows = file.cards().stream().map(card -> {
            CatalogFile.Effect effect = card.ability().effect();
            CatalogFile.Condition condition = effect == null ? null : effect.condition();
            return new Object[] {
            card.id(), file.season(), card.number(), card.wikidataId(),
            card.name().fr(), card.name().en(), card.role().fr(), card.role().en(), card.country(),
            card.continent().key(), card.era().key(), card.birthYear(), card.deathYear(), card.isLiving(),
            card.fameScore(), card.rarity().key(), card.bio().fr(), card.bio().en(),
            card.stats().influence(), card.stats().diplomacy(), card.stats().charisma(), card.stats().strategy(),
            card.ability().name().fr(), card.ability().name().en(),
            card.ability().description().fr(), card.ability().description().en(),
            effect == null ? null : effect.type(), effect == null ? null : effect.stat(),
            effect == null ? null : effect.amount(), condition == null ? null : condition.kind(),
            condition == null || condition.value() == null ? null : String.valueOf(condition.value()),
            card.sensitive(), card.artwork()
            };
        }).toList();
        jdbcTemplate.batchUpdate(UPSERT_CARD, rows);
    }

    private void deactivateMissing(CatalogFile file) {
        List<String> ids = file.cards().stream().map(CatalogFile.Entry::id).toList();
        jdbc.sql("update cards set active = false where season = :season and active and not (id = any(:ids))")
                .param("season", file.season())
                .param("ids", ids.toArray(String[]::new))
                .update();
    }

    static String sha256(byte[] content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is always available", e);
        }
    }
}
