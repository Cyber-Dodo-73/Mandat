package com.mandat.api.common.scheduling;

import java.lang.management.ManagementFactory;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Database lease so a scheduled job runs on one instance at a time (ShedLock-style). A lease
 * expires by itself, so a crashed instance never blocks a job for longer than {@code atMost}.
 */
@Component
public class SchedulerLock {

    private static final String OWNER = ManagementFactory.getRuntimeMXBean().getName();

    private final JdbcClient jdbc;
    private final Clock clock;

    public SchedulerLock(JdbcClient jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    /** Runs {@code job} if the named lease is free; returns false when another instance holds it. */
    public boolean runExclusively(String name, Duration atMost, Runnable job) {
        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        int acquired = jdbc.sql("""
                insert into scheduler_locks (name, locked_until, locked_by) values (:name, :until, :owner)
                on conflict (name) do update set locked_until = excluded.locked_until, locked_by = excluded.locked_by
                where scheduler_locks.locked_until <= :now
                """)
                .param("name", name).param("until", Timestamp.from(now.plus(atMost))).param("owner", OWNER).param("now", Timestamp.from(now))
                .update();
        if (acquired == 0) {
            return false;
        }
        try {
            job.run();
        } finally {
            jdbc.sql("update scheduler_locks set locked_until = :now where name = :name and locked_by = :owner")
                    .param("now", Timestamp.from(clock.instant().truncatedTo(ChronoUnit.MICROS))).param("name", name).param("owner", OWNER)
                    .update();
        }
        return true;
    }
}
