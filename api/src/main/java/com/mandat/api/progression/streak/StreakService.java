package com.mandat.api.progression.streak;

import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.common.wallet.WalletService;
import com.mandat.api.common.wallet.WalletSource;
import com.mandat.api.progression.PlayerCalendar;
import com.mandat.api.progression.RewardDto;
import com.mandat.api.progression.RewardGranter;
import com.mandat.api.progression.level.XpService;
import com.mandat.api.progression.streak.StreakDtos.Currency;
import com.mandat.api.progression.streak.StreakDtos.DayStatusDto;
import com.mandat.api.progression.streak.StreakDtos.FreezePricesDto;
import com.mandat.api.progression.streak.StreakDtos.MilestoneDto;
import com.mandat.api.progression.streak.StreakDtos.NextMilestoneDto;
import com.mandat.api.progression.streak.StreakDtos.PurchaseFreezeResponse;
import com.mandat.api.progression.streak.StreakDtos.RepairDto;
import com.mandat.api.progression.streak.StreakDtos.StreakDayDto;
import com.mandat.api.progression.streak.StreakDtos.StreakHistoryResponse;
import com.mandat.api.progression.streak.StreakDtos.StreakResponse;
import com.mandat.api.progression.streak.StreakMilestones.Milestone;
import com.mandat.api.progression.streak.StreakRepository.DayStatus;
import com.mandat.api.progression.streak.StreakRules.Activity;
import com.mandat.api.progression.streak.StreakRules.RepairOffer;
import com.mandat.api.progression.streak.StreakRules.State;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Individual streak: activity, milestones, freezes (earned and bought), repair and history. */
@Service
public class StreakService {

    public static final int MAX_HISTORY_DAYS = 120;

    private final StreakRepository repository;
    private final PlayerCalendar calendar;
    private final XpService xp;
    private final RewardGranter rewards;
    private final WalletService wallet;
    private final FriendStreakService friendStreaks;
    private final StreakProperties properties;
    private final JdbcClient jdbc;
    private final Clock clock;

    StreakService(StreakRepository repository, PlayerCalendar calendar, XpService xp, RewardGranter rewards,
            WalletService wallet, FriendStreakService friendStreaks, StreakProperties properties, JdbcClient jdbc,
            Clock clock) {
        this.repository = repository;
        this.calendar = calendar;
        this.xp = xp;
        this.rewards = rewards;
        this.wallet = wallet;
        this.friendStreaks = friendStreaks;
        this.properties = properties;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    /** Records a streak activity at {@code at} (server time) and returns the new streak. */
    @Transactional
    public int recordActivity(UUID userId, Instant at) {
        xp.ensure(userId);
        State state = repository.lock(userId);
        LocalDate today = PlayerCalendar.localDate(at, calendar.zoneOf(userId));
        Activity activity = StreakRules.recordActivity(state, today);
        if (!activity.counted()) {
            return state.current();
        }
        repository.markDays(userId, activity.frozenDays(), DayStatus.frozen);
        repository.markDay(userId, today, DayStatus.active);
        State next = grantMilestones(userId, activity.state(), at);
        repository.save(userId, next, at);
        friendStreaks.onActivity(userId, today, at);
        return next.current();
    }

    /** Rewards every milestone up to the current streak not rewarded yet (once per lifetime). */
    private State grantMilestones(UUID userId, State state, Instant at) {
        State next = state;
        for (Milestone milestone : StreakMilestones.PERSONAL) {
            if (milestone.days() <= next.current() && repository.claimMilestone(userId, milestone.days(), at)) {
                rewards.grant(userId, milestone.reward(), "streak." + milestone.days(), at, WalletSource.STREAK_MILESTONE);
                next = StreakRules.addFreezes(next, milestone.freezes());
            }
        }
        return next;
    }

    // --- Views ---------------------------------------------------------------------------------

    @Transactional
    public StreakResponse view(UUID userId) {
        Instant now = now();
        xp.ensure(userId);
        ZoneId zone = calendar.zoneOf(userId);
        LocalDate today = PlayerCalendar.localDate(now, zone);
        State state = repository.find(userId).orElse(State.fresh());
        int current = StreakRules.effectiveStreak(state, today);
        Set<Integer> reached = claimedMilestones(userId);
        List<MilestoneDto> milestones = StreakMilestones.PERSONAL.stream()
                .map(m -> new MilestoneDto(m.days(), reached.contains(m.days()), RewardDto.from(m.reward()), m.freezes()))
                .toList();
        NextMilestoneDto next = StreakMilestones.next(StreakMilestones.PERSONAL, current)
                .map(m -> new NextMilestoneDto(m.days(), m.days() - current, RewardDto.from(m.reward()), m.freezes()))
                .orElse(null);
        RepairOffer offer = StreakRules.repairOffer(state, today);
        Instant dayEnd = PlayerCalendar.nextDailyReset(now, zone);
        RepairDto repair = new RepairDto(offer != null, offer == null ? null : offer.restoresTo(),
                offer == null ? null : dayEnd, YearMonth.from(today).toString().equals(state.lastRepairMonth()));
        return new StreakResponse(
                current,
                state.best(),
                StreakRules.activeToday(state, today),
                today,
                zone.getId(),
                dayEnd,
                StreakRules.freezesAvailable(state, today),
                StreakRules.MAX_FREEZES,
                new FreezePricesDto(properties.freezePriceInfluence(),
                        properties.sceauxEnabled() ? properties.freezePriceSceaux() : null),
                wallet.balance(userId).influence(),
                milestones,
                next,
                repair);
    }

    /** Last {@code days} calendar days (player timezone), oldest first. */
    @Transactional(readOnly = true)
    public StreakHistoryResponse history(UUID userId, int days) {
        int span = Math.max(1, Math.min(MAX_HISTORY_DAYS, days));
        LocalDate today = PlayerCalendar.localDate(now(), calendar.zoneOf(userId));
        LocalDate from = today.minusDays(span - 1L);
        Map<LocalDate, DayStatus> kept = repository.days(userId, from, today);
        Optional<LocalDate> first = repository.firstDay(userId);
        List<StreakDayDto> result = new ArrayList<>(span);
        for (LocalDate d = from; !d.isAfter(today); d = d.plusDays(1)) {
            DayStatus status = kept.get(d);
            DayStatusDto dto;
            if (status == DayStatus.active) {
                dto = DayStatusDto.ACTIVE;
            } else if (status == DayStatus.frozen) {
                dto = DayStatusDto.FROZEN;
            } else if (d.equals(today)) {
                dto = DayStatusDto.TODAY;
            } else if (first.isPresent() && d.isAfter(first.get())) {
                dto = DayStatusDto.MISSED;
            } else {
                dto = DayStatusDto.NONE;
            }
            result.add(new StreakDayDto(d, dto));
        }
        return new StreakHistoryResponse(from, today, result);
    }

    // --- Repair & freezes ------------------------------------------------------------------

    /** Repairs a streak lost within the last 24 h (once per calendar month, free). */
    @Transactional
    public StreakResponse repair(UUID userId) {
        Instant now = now();
        xp.ensure(userId);
        State state = repository.lock(userId);
        LocalDate today = PlayerCalendar.localDate(now, calendar.zoneOf(userId));
        RepairOffer offer = StreakRules.repairOffer(state, today);
        if (offer == null) {
            throw new ApiException(ErrorCode.STREAK_REPAIR_UNAVAILABLE, "No streak to repair");
        }
        repository.markDays(userId, offer.bridgedDays(), DayStatus.frozen);
        State repaired = grantMilestones(userId, StreakRules.repair(state, today, offer), now);
        repository.save(userId, repaired, now);
        return view(userId);
    }

    /**
     * Buys one streak freeze. Idempotent per {@code idempotencyKey}: a replay returns the first
     * result without charging again. Sceaux (premium currency) are refused until real-money
     * purchases exist.
     */
    @Transactional
    public PurchaseFreezeResponse purchaseFreeze(UUID userId, Currency currency, String idempotencyKey) {
        if (currency == Currency.SCEAUX) {
            throw new ApiException(ErrorCode.CURRENCY_UNAVAILABLE, "Sceaux are not available yet");
        }
        Instant now = now();
        xp.ensure(userId);
        State state = repository.lock(userId);
        Optional<PurchaseFreezeResponse> replay = previousPurchase(userId, idempotencyKey);
        if (replay.isPresent()) {
            if (replay.get().currency() != currency) {
                throw new ApiException(ErrorCode.IDEMPOTENCY_KEY_REUSED, "This key was used for another purchase");
            }
            return replay.get();
        }
        LocalDate today = PlayerCalendar.localDate(now, calendar.zoneOf(userId));
        State withWeekly = StreakRules.grantWeeklyFreeze(state, today);
        if (withWeekly.freezes() >= StreakRules.MAX_FREEZES) {
            throw new ApiException(ErrorCode.FREEZE_STOCK_FULL, "Freeze stock is full");
        }
        int price = properties.freezePriceInfluence();
        wallet.spendInfluence(userId, price, WalletSource.STREAK_FREEZE);
        State next = StreakRules.addFreezes(withWeekly, 1);
        repository.save(userId, next, now);
        jdbc.sql("""
                        insert into streak_freeze_purchases (user_id, idempotency_key, currency, price, freezes_after, created_at)
                        values (:id, :key, :currency, :price, :freezes, :now)""")
                .param("id", userId).param("key", idempotencyKey).param("currency", currency.key())
                .param("price", price).param("freezes", next.freezes()).param("now", Timestamp.from(now))
                .update();
        return new PurchaseFreezeResponse(currency, price, next.freezes(), StreakRules.MAX_FREEZES,
                wallet.balance(userId).influence());
    }

    private Optional<PurchaseFreezeResponse> previousPurchase(UUID userId, String key) {
        return jdbc.sql("select currency, price, freezes_after from streak_freeze_purchases where user_id = :id and idempotency_key = :key")
                .param("id", userId).param("key", key)
                .query((rs, row) -> new PurchaseFreezeResponse(Currency.fromKey(rs.getString("currency")),
                        rs.getInt("price"), rs.getInt("freezes_after"), StreakRules.MAX_FREEZES,
                        wallet.balance(userId).influence()))
                .optional();
    }

    private Set<Integer> claimedMilestones(UUID userId) {
        return jdbc.sql("select milestone from streak_milestone_rewards where user_id = :id")
                .param("id", userId).query(Integer.class).list().stream().collect(Collectors.toSet());
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }
}
