package com.mandat.api.common.email;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * SMTP relay for transactional emails. With no host, emails are not sent: a log line records that
 * one would have been (without its content), and features relying on email degrade gracefully.
 *
 * @param host     SMTP host (MANDAT_SMTP_HOST), empty = disabled
 * @param port     SMTP port (MANDAT_SMTP_PORT), 587 with STARTTLS by default
 * @param username SMTP user (MANDAT_SMTP_USERNAME)
 * @param password SMTP password (MANDAT_SMTP_PASSWORD)
 * @param from     sender address (MANDAT_SMTP_FROM)
 */
@ConfigurationProperties(prefix = "mandat.smtp")
public record EmailProperties(
        String host,
        @DefaultValue("587") int port,
        String username,
        String password,
        @DefaultValue("MANDAT <no-reply@cyber-dodo.fr>") String from) {

    public boolean configured() {
        return host != null && !host.isBlank();
    }

    @Override
    public String toString() {
        return "EmailProperties[host=" + host + ", port=" + port + ", from=" + from + "]";
    }
}
