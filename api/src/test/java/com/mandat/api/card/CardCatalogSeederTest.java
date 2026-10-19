package com.mandat.api.card;

import static org.assertj.core.api.Assertions.assertThat;

import com.mandat.api.support.GameTestConfig;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.simple.JdbcClient;

@SpringBootTest
@AutoConfigureMockMvc // same context as the other game tests
@Import(GameTestConfig.class)
class CardCatalogSeederTest {

    @Autowired
    CardCatalogSeeder seeder;

    @Autowired
    CardCatalogService catalogService;

    @Autowired
    JdbcClient jdbc;

    @Test
    void seedingIsIdempotentAndDeactivatesRemovedCards() throws IOException {
        byte[] original;
        try (InputStream input = new ClassPathResource("catalog/cards.test.json").getInputStream()) {
            original = input.readAllBytes();
        }
        // Already seeded at startup with the same content.
        assertThat(seeder.seed(original)).isFalse();
        String version = catalogService.catalog(1).orElseThrow().version();

        String withoutLastCard = new String(original, StandardCharsets.UTF_8)
                .replaceFirst(",\\s*\\{\\s*\"id\": \"t-072\"[\\s\\S]*?\"sensitive\": false\\s*}", "");
        try {
            assertThat(seeder.seed(withoutLastCard.getBytes(StandardCharsets.UTF_8))).isTrue();
            assertThat(active("t-072")).isFalse();
            assertThat(catalogService.catalog(1).orElseThrow().version()).isNotEqualTo(version);
            assertThat(catalogService.activeCards(1)).hasSize(71);
        } finally {
            assertThat(seeder.seed(original)).isTrue();
        }
        assertThat(active("t-072")).isTrue();
        assertThat(catalogService.catalog(1).orElseThrow().version()).isEqualTo(version);
    }

    private boolean active(String cardId) {
        return jdbc.sql("select active from cards where id = :id").param("id", cardId).query(Boolean.class).single();
    }
}
