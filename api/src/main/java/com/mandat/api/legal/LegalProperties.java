package com.mandat.api.legal;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Operator identity and terms version shown on the legal pages and required at sign-up.
 * Bumping {@code termsVersion} makes every player accept the terms again on next launch.
 *
 * @param termsVersion  current version of the terms of service and privacy policy (MANDAT_TERMS_VERSION)
 * @param minimumAge    minimum age players must confirm (15 = French digital majority, MANDAT_MINIMUM_AGE)
 * @param operatorName  legal name of the publisher (MANDAT_OPERATOR_NAME)
 * @param operatorAddress postal address of the publisher (MANDAT_OPERATOR_ADDRESS)
 * @param contactEmail  support and privacy contact (MANDAT_CONTACT_EMAIL)
 * @param host          hosting provider shown in the legal notice (MANDAT_HOSTING_PROVIDER)
 */
@ConfigurationProperties(prefix = "mandat.legal")
public record LegalProperties(
        @DefaultValue("2026-10-19") String termsVersion,
        @DefaultValue("15") int minimumAge,
        @DefaultValue("Éditeur de MANDAT (à compléter)") String operatorName,
        @DefaultValue("Adresse à compléter") String operatorAddress,
        @DefaultValue("contact@cyber-dodo.fr") String contactEmail,
        @DefaultValue("Hébergeur à compléter") String host) {}
