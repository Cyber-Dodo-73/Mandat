package com.mandat.api.economy;

import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Craft allowance, timed like the free boosters: {@code available = min(max, (now - anchor) / interval)}.
 * Taking one moves the anchor forward by one interval (or restarts the clock when the stock was full,
 * so time spent at full stock is not banked).
 */
@Service
public class CraftAllowanceService {

    private final JdbcClient jdbc;

    public CraftAllowanceService(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(propagation = Propagation.SUPPORTS, readOnly = true)
    public Allowance allowance(UUID userId, Instant now) {
        Instant anchor = jdbc.sql("select anchor from craft_allowances where user_id = :userId")
                .param("userId", userId)
                .query(Timestamp.class)
                .optional()
                .map(Timestamp::toInstant)
                .orElseGet(() -> startingAnchor(now));
        return compute(anchor, now);
    }

    /** Takes one craft from the allowance, inside the craft transaction; fails when none is available. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void consume(UUID userId, Instant now) {
        jdbc.sql("""
                        insert into craft_allowances (user_id, anchor) values (:userId, :anchor)
                        on conflict (user_id) do nothing
                        """)
                .param("userId", userId)
                .param("anchor", Timestamp.from(startingAnchor(now)))
                .update();
        Instant anchor = jdbc.sql("select anchor from craft_allowances where user_id = :userId for update")
                .param("userId", userId)
                .query(Timestamp.class)
                .single()
                .toInstant();
        Allowance allowance = compute(anchor, now);
        if (allowance.available() == 0) {
            throw new ApiException(ErrorCode.CRAFT_LIMIT_REACHED);
        }
        Instant next = allowance.available() >= RewardLimits.CRAFT_MAX_STOCK
                ? now.minus(RewardLimits.CRAFT_INTERVAL.multipliedBy(RewardLimits.CRAFT_MAX_STOCK - 1))
                : anchor.plus(RewardLimits.CRAFT_INTERVAL);
        jdbc.sql("update craft_allowances set anchor = :anchor where user_id = :userId")
                .param("anchor", Timestamp.from(next))
                .param("userId", userId)
                .update();
    }

    static Allowance compute(Instant anchor, Instant now) {
        Duration interval = RewardLimits.CRAFT_INTERVAL;
        long elapsed = Math.max(0, Duration.between(anchor, now).toMillis());
        long earned = elapsed / interval.toMillis();
        int available = (int) Math.min(RewardLimits.CRAFT_MAX_STOCK, earned);
        Instant nextAt = available >= RewardLimits.CRAFT_MAX_STOCK ? null : anchor.plus(interval.multipliedBy(earned + 1));
        return new Allowance(available, RewardLimits.CRAFT_MAX_STOCK, nextAt);
    }

    private static Instant startingAnchor(Instant now) {
        return now.minus(RewardLimits.CRAFT_INTERVAL.multipliedBy(RewardLimits.CRAFT_STARTING_STOCK));
    }

    /** {@code nextAt} is null when the stock is full. */
    public record Allowance(int available, int max, Instant nextAt) {}
}
