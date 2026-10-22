package com.mandat.api.common.monitoring;

import com.mandat.api.common.security.AuthenticatedUser;
import io.sentry.protocol.User;
import io.sentry.spring7.SentryUserProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Tags every Sentry event with the account id of the signed-in player, nothing else: enough to
 * match a report to a support request, no personal data. Inert while Sentry is off (empty DSN).
 */
@Configuration
class SentryUserContext {

    @Bean
    SentryUserProvider accountIdUserProvider() {
        return () -> {
            var authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null || !(authentication.getPrincipal() instanceof AuthenticatedUser principal)) {
                return null;
            }
            User user = new User();
            user.setId(principal.id().toString());
            return user;
        };
    }
}
