package com.mandat.api.push;

import java.sql.Timestamp;
import com.mandat.api.progression.PlayerCalendar;
import com.mandat.api.push.ExpoPushClient.Message;
import com.mandat.api.push.ExpoPushClient.Ticket;
import com.mandat.api.push.PushDeviceRepository.Device;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * Sends one notification to every enabled device of a player, after every guard: global switch,
 * account setting, category opt-in, quiet hours, daily caps and dedupe key (a key is sent at most
 * once per player). Notifications skipped for quiet hours are not recorded, so the scheduled jobs
 * send them once the quiet window ends.
 */
@Service
public class PushSender {

    public enum Outcome { SENT, DISABLED, NO_DEVICE, OPTED_OUT, QUIET_HOURS, CAPPED, DUPLICATE }

    private static final Logger log = LoggerFactory.getLogger(PushSender.class);

    private final PushProperties properties;
    private final ExpoPushClient client;
    private final PushDeviceRepository devices;
    private final PushPreferencesRepository preferences;
    private final PlayerCalendar calendar;
    private final JdbcClient jdbc;
    private final Clock clock;

    PushSender(PushProperties properties, ExpoPushClient client, PushDeviceRepository devices,
            PushPreferencesRepository preferences, PlayerCalendar calendar, JdbcClient jdbc, Clock clock) {
        this.properties = properties;
        this.client = client;
        this.devices = devices;
        this.preferences = preferences;
        this.calendar = calendar;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    public Outcome send(UUID userId, PushNotification notification, String dedupeKey) {
        if (!properties.enabled()) {
            return Outcome.DISABLED;
        }
        Boolean accountEnabled = jdbc.sql("select notifications_enabled from users where id = :id")
                .param("id", userId).query(Boolean.class).optional().orElse(false);
        PushCategory category = notification.category();
        if (!accountEnabled || !Boolean.TRUE.equals(preferences.find(userId).get(category))) {
            return Outcome.OPTED_OUT;
        }
        List<Device> targets = devices.enabledDevices(userId);
        if (targets.isEmpty()) {
            return Outcome.NO_DEVICE;
        }
        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        ZoneId zone = calendar.zoneOf(userId);
        ZonedDateTime local = now.atZone(zone);
        if (properties.isQuietHour(local.getHour())) {
            return Outcome.QUIET_HOURS;
        }
        LocalDate day = local.toLocalDate();
        if (capped(userId, day, category)) {
            return Outcome.CAPPED;
        }
        boolean recorded = jdbc.sql("""
                insert into push_notifications (user_id, category, dedupe_key, local_day, transactional, sent_at)
                values (:userId, :category, :key, :day, :transactional, :now)
                on conflict (user_id, dedupe_key) do nothing
                """)
                .param("userId", userId).param("category", category.key()).param("key", dedupeKey)
                .param("day", day).param("transactional", category.transactional()).param("now", Timestamp.from(now))
                .update() > 0;
        if (!recorded) {
            return Outcome.DUPLICATE;
        }
        deliver(targets, notification, now);
        return Outcome.SENT;
    }

    private boolean capped(UUID userId, LocalDate day, PushCategory category) {
        Map<String, Object> counts = jdbc.sql("""
                select count(*) as total, count(*) filter (where not transactional) as reminders
                from push_notifications where user_id = :userId and local_day = :day
                """)
                .param("userId", userId).param("day", day).query().singleRow();
        long total = ((Number) counts.get("total")).longValue();
        long reminders = ((Number) counts.get("reminders")).longValue();
        return total >= properties.dailyCap()
                || (!category.transactional() && reminders >= properties.reminderDailyCap());
    }

    private void deliver(List<Device> targets, PushNotification notification, Instant now) {
        for (int from = 0; from < targets.size(); from += ExpoPushClient.MAX_BATCH) {
            List<Device> batch = targets.subList(from, Math.min(targets.size(), from + ExpoPushClient.MAX_BATCH));
            List<Message> messages = new ArrayList<>(batch.size());
            for (Device device : batch) {
                PushNotification.Text text = notification.text(device.locale());
                messages.add(new Message(device.token(), text.title(), text.body(),
                        Map.of("path", notification.path(), "category", notification.category().key())));
            }
            List<Ticket> tickets;
            try {
                tickets = client.send(messages);
            } catch (RuntimeException e) {
                log.warn("Push delivery failed: {}", e.getClass().getSimpleName());
                continue;
            }
            for (int i = 0; i < batch.size() && i < tickets.size(); i++) {
                Ticket ticket = tickets.get(i);
                String token = batch.get(i).token();
                if (ticket.ok() && ticket.id() != null) {
                    devices.saveTicket(ticket.id(), token, now);
                } else if (ExpoPushClient.DEVICE_NOT_REGISTERED.equals(ticket.error())) {
                    devices.disable(token);
                }
            }
        }
    }

}
