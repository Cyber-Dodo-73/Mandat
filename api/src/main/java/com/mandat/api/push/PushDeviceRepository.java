package com.mandat.api.push;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class PushDeviceRepository {

    public record Device(String token, String platform, String locale) {}

    private final JdbcClient jdbc;

    PushDeviceRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Registers or refreshes a token; a token moving to another account follows the account. */
    public void upsert(UUID userId, String token, String platform, String locale, Instant now) {
        jdbc.sql("""
                insert into push_devices (user_id, token, platform, locale, enabled, created_at, last_seen_at)
                values (:userId, :token, :platform, :locale, true, :now, :now)
                on conflict (token) do update set
                    user_id = excluded.user_id,
                    platform = excluded.platform,
                    locale = excluded.locale,
                    enabled = true,
                    created_at = case when push_devices.user_id = excluded.user_id
                                      then push_devices.created_at else excluded.created_at end,
                    last_seen_at = excluded.last_seen_at
                """)
                .param("userId", userId).param("token", token).param("platform", platform)
                .param("locale", locale).param("now", Timestamp.from(now))
                .update();
    }

    public boolean delete(UUID userId, String token) {
        return jdbc.sql("delete from push_devices where user_id = :userId and token = :token")
                .param("userId", userId).param("token", token).update() > 0;
    }

    public List<Device> enabledDevices(UUID userId) {
        return jdbc.sql("select token, platform, locale from push_devices where user_id = :userId and enabled order by created_at")
                .param("userId", userId)
                .query((rs, row) -> new Device(rs.getString("token"), rs.getString("platform"), rs.getString("locale")))
                .list();
    }

    /** First registration time of a still-enabled device, null without any. */
    public Instant firstRegistration(UUID userId) {
        Timestamp first = jdbc.sql("select min(created_at) from push_devices where user_id = :userId and enabled")
                .param("userId", userId).query(Timestamp.class).optional().orElse(null);
        return first == null ? null : first.toInstant();
    }

    /** Dead token reported by Expo (DeviceNotRegistered): never targeted again. */
    public void disable(String token) {
        jdbc.sql("update push_devices set enabled = false where token = :token").param("token", token).update();
    }

    public void saveTicket(String ticketId, String token, Instant now) {
        jdbc.sql("insert into push_tickets (ticket_id, token, created_at) values (:id, :token, :now) on conflict do nothing")
                .param("id", ticketId).param("token", token).param("now", Timestamp.from(now)).update();
    }

    public record PendingTicket(String ticketId, String token) {}

    public List<PendingTicket> ticketsOlderThan(Instant before, int limit) {
        return jdbc.sql("select ticket_id, token from push_tickets where created_at <= :before order by created_at limit :limit")
                .param("before", Timestamp.from(before)).param("limit", limit)
                .query((rs, row) -> new PendingTicket(rs.getString("ticket_id"), rs.getString("token")))
                .list();
    }

    public void deleteTickets(List<String> ticketIds) {
        if (!ticketIds.isEmpty()) {
            jdbc.sql("delete from push_tickets where ticket_id in (:ids)").param("ids", ticketIds).update();
        }
    }
}
