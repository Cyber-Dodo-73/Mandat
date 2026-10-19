package com.mandat.api.push;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Expo push HTTP client: JSON over HTTPS, retried with backoff on 429, 5xx and network errors.
 * Tokens are never logged.
 */
@Component
class HttpExpoPushClient implements ExpoPushClient {

    private static final Logger log = LoggerFactory.getLogger(HttpExpoPushClient.class);
    private static final int ATTEMPTS = 3;
    private static final Duration TIMEOUT = Duration.ofSeconds(15);

    private final PushProperties properties;
    private final JsonMapper json;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();

    HttpExpoPushClient(PushProperties properties, JsonMapper json) {
        this.properties = properties;
        this.json = json;
    }

    @Override
    public List<Ticket> send(List<Message> messages) {
        if (messages.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> payload = new ArrayList<>(messages.size());
        for (Message message : messages) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("to", message.to());
            item.put("title", message.title());
            item.put("body", message.body());
            item.put("data", message.data());
            item.put("sound", "default");
            item.put("channelId", "default");
            payload.add(item);
        }
        JsonNode response = post(properties.sendUrl(), payload);
        List<Ticket> tickets = new ArrayList<>(messages.size());
        JsonNode data = response == null ? null : response.get("data");
        for (int i = 0; i < messages.size(); i++) {
            JsonNode ticket = data != null && data.isArray() && i < data.size() ? data.get(i) : null;
            tickets.add(ticket == null ? new Ticket("error", null, "NoTicket") : toTicket(ticket));
        }
        return tickets;
    }

    @Override
    public Map<String, Receipt> receipts(List<String> ticketIds) {
        if (ticketIds.isEmpty()) {
            return Map.of();
        }
        JsonNode response = post(properties.receiptsUrl(), Map.of("ids", ticketIds));
        Map<String, Receipt> receipts = new HashMap<>();
        JsonNode data = response == null ? null : response.get("data");
        if (data != null && data.isObject()) {
            for (String id : ticketIds) {
                JsonNode receipt = data.get(id);
                if (receipt != null) {
                    receipts.put(id, new Receipt(text(receipt, "status"), errorCode(receipt)));
                }
            }
        }
        return receipts;
    }

    private Ticket toTicket(JsonNode node) {
        return new Ticket(text(node, "status"), text(node, "id"), errorCode(node));
    }

    private static String errorCode(JsonNode node) {
        JsonNode details = node.get("details");
        String code = details == null ? null : text(details, "error");
        return code != null ? code : "error".equals(text(node, "status")) ? "Unknown" : null;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asString();
    }

    /** POSTs JSON; null after the last failed attempt (sending is best effort). */
    private JsonNode post(URI url, Object body) {
        String encoded = json.writeValueAsString(body);
        for (int attempt = 1; attempt <= ATTEMPTS; attempt++) {
            HttpRequest.Builder request = HttpRequest.newBuilder(url)
                    .timeout(TIMEOUT)
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(encoded));
            if (properties.hasAccessToken()) {
                request.header("Authorization", "Bearer " + properties.expoAccessToken());
            }
            try {
                HttpResponse<String> response = http.send(request.build(), HttpResponse.BodyHandlers.ofString());
                int status = response.statusCode();
                if (status >= 200 && status < 300) {
                    return json.readTree(response.body());
                }
                if (status != 429 && status < 500) {
                    log.warn("Expo push request rejected with status {}", status);
                    return null;
                }
                log.info("Expo push request failed with status {} (attempt {}/{})", status, attempt, ATTEMPTS);
            } catch (IOException e) {
                log.info("Expo push request failed: {} (attempt {}/{})", e.getClass().getSimpleName(), attempt, ATTEMPTS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return null;
            }
            if (attempt < ATTEMPTS && !sleep(Duration.ofSeconds(1L << (attempt - 1)))) {
                return null;
            }
        }
        return null;
    }

    private static boolean sleep(Duration duration) {
        try {
            Thread.sleep(duration);
            return true;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }
}
