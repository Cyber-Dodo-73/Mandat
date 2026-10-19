package com.mandat.api.push;

import com.mandat.api.pack.FreePackTimer;
import com.mandat.api.push.ExpoPushClient.Receipt;
import com.mandat.api.push.PushDeviceRepository.PendingTicket;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Time-based pushes, computed from server state with the server clock, in each player's timezone.
 * Every job is idempotent (dedupe keys), so running it often only sends what became due.
 */
@Component
public class PushJobs {

    /** A booster that became ready more than this long ago is not announced any more. */
    static final Duration BOOSTER_FRESHNESS = Duration.ofHours(24);
    static final int RECEIPT_BATCH = 1000;
    static final Duration TICKET_MAX_AGE = Duration.ofHours(24);

    private final PushSender sender;
    private final PushDeviceRepository devices;
    private final ExpoPushClient client;
    private final PushProperties properties;
    private final JdbcClient jdbc;
    private final Clock clock;

    PushJobs(PushSender sender, PushDeviceRepository devices, ExpoPushClient client, PushProperties properties,
            JdbcClient jdbc, Clock clock) {
        this.sender = sender;
        this.devices = devices;
        this.client = client;
        this.properties = properties;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    private record BoosterCandidate(UUID userId, Instant anchor, Instant lastOpened, Instant firstDevice) {}

    /**
     * "Your free booster is ready" once per newly accrued free booster: it must have accrued after
     * the player's last opening and after their first device registration (no stale announcement).
     */
    public int boosterReady() {
        Instant now = clock.instant();
        List<BoosterCandidate> candidates = jdbc.sql("""
                select s.user_id, s.free_packs_anchor,
                       (select max(o.opened_at) from pack_openings o where o.user_id = s.user_id) as last_opened,
                       (select min(d.created_at) from push_devices d where d.user_id = s.user_id and d.enabled) as first_device
                from pack_states s
                where exists (select 1 from push_devices d where d.user_id = s.user_id and d.enabled)
                """)
                .query((rs, row) -> new BoosterCandidate(rs.getObject("user_id", UUID.class),
                        instant(rs.getTimestamp("free_packs_anchor")), instant(rs.getTimestamp("last_opened")),
                        instant(rs.getTimestamp("first_device"))))
                .list();
        int sent = 0;
        for (BoosterCandidate candidate : candidates) {
            int available = FreePackTimer.available(candidate.anchor(), now);
            if (available == 0) {
                continue;
            }
            Instant accruedAt = candidate.anchor().plus(FreePackTimer.INTERVAL.multipliedBy(available));
            Instant floor = later(candidate.lastOpened(), candidate.firstDevice());
            if ((floor != null && !accruedAt.isAfter(floor.plusSeconds(1))) || accruedAt.isBefore(now.minus(BOOSTER_FRESHNESS))) {
                continue;
            }
            if (sender.send(candidate.userId(), new PushNotification.BoosterReady(), "booster:" + accruedAt.getEpochSecond())
                    == PushSender.Outcome.SENT) {
                sent++;
            }
        }
        return sent;
    }

    private record StreakCandidate(UUID userId, String timezone, int streak, LocalDate lastActiveDay) {}

    /** At {@code streakReminderHour} local, players whose streak would be lost tonight. */
    public int streakAtRisk() {
        Instant now = clock.instant();
        List<StreakCandidate> candidates = jdbc.sql("""
                select p.user_id, u.timezone, p.current_streak, p.last_active_day
                from player_progress p join users u on u.id = p.user_id
                where p.current_streak > 0 and p.last_active_day is not null
                  and exists (select 1 from push_devices d where d.user_id = p.user_id and d.enabled)
                """)
                .query((rs, row) -> new StreakCandidate(rs.getObject("user_id", UUID.class), rs.getString("timezone"),
                        rs.getInt("current_streak"), rs.getObject("last_active_day", LocalDate.class)))
                .list();
        int sent = 0;
        for (StreakCandidate candidate : candidates) {
            ZonedDateTime local = now.atZone(zone(candidate.timezone()));
            LocalDate today = local.toLocalDate();
            if (local.getHour() < properties.streakReminderHour() || !candidate.lastActiveDay().equals(today.minusDays(1))) {
                continue;
            }
            if (sender.send(candidate.userId(), new PushNotification.StreakAtRisk(candidate.streak()), "streak:" + today)
                    == PushSender.Outcome.SENT) {
                sent++;
            }
        }
        return sent;
    }

    private record Player(UUID userId, String timezone) {}

    /** Evening reminder for completed but unclaimed daily missions (a non-transactional reminder). */
    public int unclaimedRewards() {
        Instant now = clock.instant();
        List<Player> players = jdbc.sql("""
                select u.id, u.timezone from users u
                where exists (select 1 from push_devices d where d.user_id = u.id and d.enabled)
                  and exists (select 1 from player_missions m
                              where m.user_id = u.id and m.completed_at is not null and m.claimed_at is null)
                """)
                .query((rs, row) -> new Player(rs.getObject("id", UUID.class), rs.getString("timezone")))
                .list();
        int sent = 0;
        for (Player player : players) {
            ZonedDateTime local = now.atZone(zone(player.timezone()));
            LocalDate today = local.toLocalDate();
            if (local.getHour() < properties.rewardsReminderHour()) {
                continue;
            }
            boolean unclaimedToday = jdbc.sql("""
                    select exists (select 1 from player_missions where user_id = :id and period_key = :key
                                   and completed_at is not null and claimed_at is null)
                    """)
                    .param("id", player.userId()).param("key", "D:" + today)
                    .query(Boolean.class).single();
            if (unclaimedToday && sender.send(player.userId(), new PushNotification.RewardsUnclaimed(), "rewards:" + today)
                    == PushSender.Outcome.SENT) {
                sent++;
            }
        }
        return sent;
    }

    /** Reads Expo receipts of past sends and disables the tokens Expo reports as not registered. */
    public int checkReceipts() {
        Instant now = clock.instant();
        List<PendingTicket> pending = devices.ticketsOlderThan(now.minus(properties.receiptDelay()), RECEIPT_BATCH);
        if (pending.isEmpty()) {
            return 0;
        }
        Map<String, Receipt> receipts = client.receipts(pending.stream().map(PendingTicket::ticketId).toList());
        List<String> done = new ArrayList<>();
        int disabled = 0;
        for (PendingTicket ticket : pending) {
            Receipt receipt = receipts.get(ticket.ticketId());
            if (receipt != null) {
                done.add(ticket.ticketId());
                if (ExpoPushClient.DEVICE_NOT_REGISTERED.equals(receipt.error())) {
                    devices.disable(ticket.token());
                    disabled++;
                }
            }
        }
        devices.deleteTickets(done);
        jdbc.sql("delete from push_tickets where created_at < :before").param("before", Timestamp.from(now.minus(TICKET_MAX_AGE))).update();
        return disabled;
    }

    private static Instant instant(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }

    private static Instant later(Instant a, Instant b) {
        if (a == null) {
            return b;
        }
        return b == null || a.isAfter(b) ? a : b;
    }

    private static ZoneId zone(String timezone) {
        try {
            return ZoneId.of(timezone);
        } catch (RuntimeException e) {
            return ZoneId.of("UTC");
        }
    }
}
