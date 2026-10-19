package com.mandat.api.economy;

import com.mandat.api.common.entitlement.EntitlementProvider;
import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.economy.RewardLimits.CraftPolicy;
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
 * so time spent at full stock is not banked). Interval and stock depend on the player's entitlement.
 */
@Service
public class CraftAllowanceService {

    private final JdbcClient jdbc;
    private final EntitlementProvider entitlements;

    public CraftAllowanceService(JdbcClient jdbc, EntitlementProvider entitlements) {
        this.jdbc = jdbc;
        this.entitlements = entitlements;
    }

    @Transactional(propagation = Propagation.SUPPORTS, readOnly = true)
    public Allowance allowance(UUID userId, Instant now) {
        CraftPolicy policy = policyOf(userId);
        Instant anchor = jdbc.sql("select anchor from craft_allowances where user_id = :userId")
                .param("userId", userId)
                .query(Timestamp.class)
                .optional()
                .map(Timestamp::toInstant)
                .orElseGet(() -> startingAnchor(now, policy));
        return compute(anchor, now, policy);
    }

    /** Takes one craft from the allowance, inside the craft transaction; fails when none is available. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void consume(UUID userId, Instant now) {
        CraftPolicy policy = policyOf(userId);
        jdbc.sql("""
                        insert into craft_allowances (user_id, anchor) values (:userId, :anchor)
                        on conflict (user_id) do nothing
                        """)
                .param("userId", userId)
                .param("anchor", Timestamp.from(startingAnchor(now, policy)))
                .update();
        Instant anchor = jdbc.sql("select anchor from craft_allowances where user_id = :userId for update")
                .param("userId", userId)
                .query(Timestamp.class)
                .single()
                .toInstant();
        Allowance allowance = compute(anchor, now, policy);
        if (allowance.available() == 0) {
            throw new ApiException(ErrorCode.CRAFT_LIMIT_REACHED);
        }
        Instant next = allowance.available() >= policy.maxStock()
                ? now.minus(policy.interval().multipliedBy(policy.maxStock() - 1))
                : anchor.plus(policy.interval());
        jdbc.sql("update craft_allowances set anchor = :anchor where user_id = :userId")
                .param("anchor", Timestamp.from(next))
                .param("userId", userId)
                .update();
    }

    public CraftPolicy policyOf(UUID userId) {
        return RewardLimits.craftPolicy(entitlements.entitlementOf(userId));
    }

    static Allowance compute(Instant anchor, Instant now, CraftPolicy policy) {
        Duration interval = policy.interval();
        long elapsed = Math.max(0, Duration.between(anchor, now).toMillis());
        long earned = elapsed / interval.toMillis();
        int available = (int) Math.min(policy.maxStock(), earned);
        Instant nextAt = available >= policy.maxStock() ? null : anchor.plus(interval.multipliedBy(earned + 1));
        return new Allowance(available, policy.maxStock(), (int) interval.toHours(), nextAt);
    }

    private static Instant startingAnchor(Instant now, CraftPolicy policy) {
        return now.minus(policy.interval().multipliedBy(policy.startingStock()));
    }

    /** {@code nextAt} is null when the stock is full. */
    public record Allowance(int available, int max, int intervalHours, Instant nextAt) {}
}
