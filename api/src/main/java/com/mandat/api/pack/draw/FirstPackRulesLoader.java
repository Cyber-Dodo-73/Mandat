package com.mandat.api.pack.draw;

import com.mandat.api.card.CatalogProperties;
import java.io.IOException;
import java.io.InputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * Onboarding booster rules: {@code data/firstPackRules.json} when present and valid, else
 * {@link FirstPackRules#DEFAULT}. Expected shape:
 * {@code {"slots":[{"rarities":["common"],"count":2},...],"distinctContinents":5,"minDistinctEras":3,"excludeSensitive":true}}.
 */
@Component
public class FirstPackRulesLoader {

    private static final Logger log = LoggerFactory.getLogger(FirstPackRulesLoader.class);

    private final FirstPackRules rules;

    public FirstPackRulesLoader(CatalogProperties properties, JsonMapper jsonMapper) {
        this.rules = load(properties.firstPackRulesLocation(), jsonMapper);
    }

    public FirstPackRules rules() {
        return rules;
    }

    private static FirstPackRules load(Resource location, JsonMapper jsonMapper) {
        if (!location.exists()) {
            log.info("First booster rules file {} not found: built-in rules apply", location.getDescription());
            return FirstPackRules.DEFAULT;
        }
        try (InputStream input = location.getInputStream()) {
            FirstPackRules loaded = jsonMapper.readValue(input, FirstPackRules.class);
            if (loaded.isValid()) {
                return loaded;
            }
            log.warn("First booster rules file {} is invalid: built-in rules apply", location.getDescription());
        } catch (IOException | JacksonException e) {
            log.warn("First booster rules file {} is unreadable: built-in rules apply", location.getDescription(), e);
        }
        return FirstPackRules.DEFAULT;
    }
}
