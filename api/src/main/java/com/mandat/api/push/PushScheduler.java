package com.mandat.api.push;

import com.mandat.api.common.scheduling.SchedulerLock;
import java.time.Duration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

/** Triggers the push jobs; each run holds a database lease so instances never overlap. */
@Configuration
@EnableScheduling
@ConditionalOnProperty(prefix = "mandat.push", name = "jobs-enabled", havingValue = "true", matchIfMissing = true)
class PushScheduler {

    private static final Duration LEASE = Duration.ofMinutes(10);

    private final PushJobs jobs;
    private final SchedulerLock lock;

    PushScheduler(PushJobs jobs, SchedulerLock lock) {
        this.jobs = jobs;
        this.lock = lock;
    }

    @Scheduled(initialDelayString = "PT1M", fixedDelayString = "PT5M")
    void boosterReady() {
        lock.runExclusively("push.booster-ready", LEASE, jobs::boosterReady);
    }

    @Scheduled(initialDelayString = "PT2M", fixedDelayString = "PT10M")
    void streakAtRisk() {
        lock.runExclusively("push.streak-at-risk", LEASE, jobs::streakAtRisk);
    }

    @Scheduled(initialDelayString = "PT3M", fixedDelayString = "PT15M")
    void unclaimedRewards() {
        lock.runExclusively("push.unclaimed-rewards", LEASE, jobs::unclaimedRewards);
    }

    @Scheduled(initialDelayString = "PT5M", fixedDelayString = "PT15M")
    void receipts() {
        lock.runExclusively("push.receipts", LEASE, jobs::checkReceipts);
    }
}
