package com.mandat.api.push;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Event-driven notifications (nudges, friend streak invitations and milestones) are stored here
 * and tried right away; one blocked by the receiver's quiet hours stays pending and the flush job
 * sends it once the quiet window ends (e.g. at 09:00). Other outcomes (sent, capped, muted, no
 * device, duplicate) close the entry. Entries expire after {@link #TTL}.
 */
@Component
public class PushOutbox {

    static final Duration TTL = Duration.ofHours(24);

    /** What an outbox entry renders to; stored as {@code kind} + one text and one number argument. */
    enum Kind {
        NUDGE, FRIEND_STREAK_INVITE, FRIEND_STREAK_MILESTONE
    }

    private record Entry(long id, UUID userId, Kind kind, String text, int number, String dedupeKey) {}

    private final PushSender sender;
    private final JdbcClient jdbc;
    private final Clock clock;

    PushOutbox(PushSender sender, JdbcClient jdbc, Clock clock) {
        this.sender = sender;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    /** Queues the notification (once per dedupe key) and tries to send it now. */
    public PushSender.Outcome enqueue(UUID userId, Kind kind, String text, int number, String dedupeKey) {
        Instant now = now();
        Long id = jdbc.sql("""
                        insert into push_outbox (user_id, kind, arg_text, arg_int, dedupe_key, created_at, expires_at)
                        values (:user, :kind, :text, :number, :key, :now, :expires)
                        on conflict (user_id, dedupe_key) do nothing returning id""")
                .param("user", userId).param("kind", kind.name()).param("text", text).param("number", number)
                .param("key", dedupeKey).param("now", Timestamp.from(now)).param("expires", Timestamp.from(now.plus(TTL)))
                .query(Long.class).optional().orElse(null);
        if (id == null) {
            return PushSender.Outcome.DUPLICATE;
        }
        return attempt(new Entry(id, userId, kind, text, number, dedupeKey));
    }

    /** Sends pending entries whose quiet hours are over; returns how many were sent. */
    public int flush() {
        Instant now = now();
        jdbc.sql("update push_outbox set done_at = :now, outcome = 'EXPIRED' where done_at is null and expires_at <= :now")
                .param("now", Timestamp.from(now)).update();
        List<Entry> pending = jdbc.sql("""
                        select id, user_id, kind, arg_text, arg_int, dedupe_key from push_outbox
                        where done_at is null order by created_at limit 500""")
                .query((rs, row) -> new Entry(rs.getLong("id"), rs.getObject("user_id", UUID.class),
                        Kind.valueOf(rs.getString("kind")), rs.getString("arg_text"), rs.getInt("arg_int"),
                        rs.getString("dedupe_key")))
                .list();
        int sent = 0;
        for (Entry entry : pending) {
            if (attempt(entry) == PushSender.Outcome.SENT) {
                sent++;
            }
        }
        return sent;
    }

    private PushSender.Outcome attempt(Entry entry) {
        PushSender.Outcome outcome = sender.send(entry.userId(), render(entry), "outbox:" + entry.dedupeKey());
        if (outcome != PushSender.Outcome.QUIET_HOURS) {
            jdbc.sql("update push_outbox set done_at = :now, outcome = :outcome where id = :id")
                    .param("now", Timestamp.from(now())).param("outcome", outcome.name()).param("id", entry.id())
                    .update();
        }
        return outcome;
    }

    private static PushNotification render(Entry entry) {
        return switch (entry.kind()) {
            case NUDGE -> new PushNotification.Nudge(entry.text());
            case FRIEND_STREAK_INVITE -> new PushNotification.FriendStreakInvite(entry.text());
            case FRIEND_STREAK_MILESTONE -> new PushNotification.FriendStreakMilestone(entry.text(), entry.number());
        };
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }
}
