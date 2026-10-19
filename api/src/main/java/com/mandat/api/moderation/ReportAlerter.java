package com.mandat.api.moderation;

import com.mandat.api.common.events.ReportFiledEvent;
import java.net.URI;
import java.time.Duration;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.client.RestClient;

/**
 * Tells the moderators a report arrived: always a log line, plus a POST to
 * {@code MANDAT_MODERATION_WEBHOOK} when set (Slack/Discord-compatible JSON, no personal data:
 * only the report id and reason, details stay behind the admin API).
 */
@Component
class ReportAlerter {

    private static final Logger log = LoggerFactory.getLogger(ReportAlerter.class);

    private final URI webhook;
    private final RestClient http;

    ReportAlerter(@Value("${mandat.moderation.webhook-url:}") String webhookUrl) {
        this.webhook = webhookUrl == null || webhookUrl.isBlank() ? null : URI.create(webhookUrl.strip());
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(5));
        this.http = RestClient.builder().requestFactory(factory).build();
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    void onReport(ReportFiledEvent event) {
        log.warn("Moderation: new report {} ({})", event.reportId(), event.reason());
        if (webhook == null) {
            return;
        }
        String text = "MANDAT: new report " + event.reportId() + " (" + event.reason() + ")";
        Thread.startVirtualThread(() -> {
            try {
                http.post().uri(webhook).contentType(MediaType.APPLICATION_JSON)
                        .body(Map.of("text", text, "content", text))
                        .retrieve()
                        .toBodilessEntity();
            } catch (RuntimeException e) {
                log.warn("Moderation webhook failed: {}", e.getClass().getSimpleName());
            }
        });
    }
}
