package com.mandat.api.progression;

import java.time.DateTimeException;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.IsoFields;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Calendar days and weeks in the player's timezone, from server time only. Days start at local
 * midnight and weeks are ISO weeks (Monday 00:00 local).
 */
@Component
public class PlayerCalendar {

    private final JdbcClient jdbc;

    public PlayerCalendar(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public ZoneId zoneOf(UUID userId) {
        String timezone = jdbc.sql("select timezone from users where id = :id")
                .param("id", userId)
                .query(String.class)
                .optional()
                .orElse("UTC");
        return parseZone(timezone);
    }

    /** The zone of a stored timezone id, UTC when unknown. */
    public static ZoneId zone(String timezone) {
        return parseZone(timezone == null ? "UTC" : timezone);
    }

    static ZoneId parseZone(String timezone) {
        try {
            return ZoneId.of(timezone);
        } catch (DateTimeException e) {
            return ZoneOffset.UTC;
        }
    }

    public static LocalDate localDate(Instant instant, ZoneId zone) {
        return LocalDate.ofInstant(instant, zone);
    }

    /** ISO week key, e.g. {@code 2026-W43}. */
    public static String isoWeek(LocalDate date) {
        return "%d-W%02d".formatted(date.get(IsoFields.WEEK_BASED_YEAR), date.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR));
    }

    public static String dailyKey(LocalDate date) {
        return "D:" + date;
    }

    public static String weeklyKey(LocalDate date) {
        return "W:" + isoWeek(date);
    }

    public static Instant nextDailyReset(Instant now, ZoneId zone) {
        return localDate(now, zone).plusDays(1).atStartOfDay(zone).toInstant();
    }

    public static Instant nextWeeklyReset(Instant now, ZoneId zone) {
        LocalDate nextMonday = localDate(now, zone).with(TemporalAdjusters.next(DayOfWeek.MONDAY));
        return nextMonday.atStartOfDay(zone).toInstant();
    }
}
