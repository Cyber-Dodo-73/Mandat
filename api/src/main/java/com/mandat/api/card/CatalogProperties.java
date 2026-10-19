package com.mandat.api.card;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.core.io.Resource;

/**
 * Where the catalog files live. In Docker, mount the repository's {@code data/} folder (read-only)
 * and point {@code MANDAT_CATALOG_LOCATION} / {@code MANDAT_CATALOG_FIRST_PACK_RULES_LOCATION} at it,
 * e.g. {@code file:/data/cards.season1.json}.
 *
 * @param location        catalog JSON ({@code {season, version, cards[]}}); missing file = no seeding
 * @param firstPackRulesLocation optional onboarding pack rules; built-in defaults apply when absent
 * @param season          season served by default and used for draws
 */
@ConfigurationProperties(prefix = "mandat.catalog")
public record CatalogProperties(
        @DefaultValue("file:../data/cards.season1.json") Resource location,
        @DefaultValue("file:../data/firstPackRules.json") Resource firstPackRulesLocation,
        @DefaultValue("1") int season) {}
