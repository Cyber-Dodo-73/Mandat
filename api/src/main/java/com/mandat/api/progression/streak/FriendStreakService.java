package com.mandat.api.progression.streak;

import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.common.events.FriendStreakInvitedEvent;
import com.mandat.api.common.events.FriendStreakMilestoneEvent;
import com.mandat.api.common.wallet.WalletSource;
import com.mandat.api.progression.PlayerCalendar;
import com.mandat.api.progression.RewardGranter;
import com.mandat.api.progression.level.XpService;
import com.mandat.api.progression.streak.FriendStreakRepository.Row;
import com.mandat.api.progression.streak.FriendStreakRepository.Status;
import com.mandat.api.progression.streak.FriendStreakRules.PlayerDays;
import com.mandat.api.progression.streak.StreakDtos.FriendStreakDto;
import com.mandat.api.progression.streak.StreakDtos.FriendStreakInviteDto;
import com.mandat.api.progression.streak.StreakDtos.FriendStreaksResponse;
import com.mandat.api.progression.streak.StreakDtos.FriendSummaryDto;
import com.mandat.api.progression.streak.StreakMilestones.Milestone;
import com.mandat.api.progression.streak.StreakRules.State;
import com.mandat.api.social.FriendshipRepository;
import com.mandat.api.social.PlayerLookup;
import com.mandat.api.user.User;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Friend streaks: mutual opt-in (invite then accept) between friends, at most
 * {@code mandat.streak.max-friend-streaks} per player, counted on shared days (see
 * {@link FriendStreakRules}). A friend streak ends when either player removes it or the
 * friendship ends.
 */
@Service
public class FriendStreakService {

    /**
     * Kept days loaded for the continuity checks. A friend streak can't survive a longer gap
     * (at most 2 freezes), so older days never matter.
     */
    private static final int LOOKBACK_DAYS = 60;

    private final FriendStreakRepository streaks;
    private final StreakRepository streakDays;
    private final FriendshipRepository friendships;
    private final PlayerLookup players;
    private final PlayerCalendar calendar;
    private final RewardGranter rewards;
    private final XpService xp;
    private final StreakProperties properties;
    private final ApplicationEventPublisher events;
    private final JdbcClient jdbc;
    private final Clock clock;

    FriendStreakService(FriendStreakRepository streaks, StreakRepository streakDays, FriendshipRepository friendships,
            PlayerLookup players, PlayerCalendar calendar, RewardGranter rewards, XpService xp,
            StreakProperties properties, ApplicationEventPublisher events, JdbcClient jdbc, Clock clock) {
        this.streaks = streaks;
        this.streakDays = streakDays;
        this.friendships = friendships;
        this.players = players;
        this.calendar = calendar;
        this.rewards = rewards;
        this.xp = xp;
        this.properties = properties;
        this.events = events;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    // --- Queries -------------------------------------------------------------------------------

    @Transactional
    public FriendStreaksResponse list(UUID userId) {
        Instant now = now();
        List<FriendStreakDto> active = new ArrayList<>();
        List<FriendStreakInviteDto> incoming = new ArrayList<>();
        List<FriendStreakInviteDto> outgoing = new ArrayList<>();
        Map<UUID, PlayerDays> cache = new HashMap<>();
        for (Row row : streaks.forUser(userId)) {
            UUID partner = row.partnerOf(userId);
            if (!friendships.areFriends(userId, partner)) {
                streaks.delete(row.id()); // the friendship ended
                continue;
            }
            FriendSummaryDto friend = summary(partner);
            if (row.status() == Status.pending) {
                FriendStreakInviteDto invite = new FriendStreakInviteDto(row.id().toString(), friend, row.createdAt());
                (row.requestedBy().equals(userId) ? outgoing : incoming).add(invite);
                continue;
            }
            PlayerDays me = cache.computeIfAbsent(userId, id -> playerDays(id, now));
            PlayerDays them = cache.computeIfAbsent(partner, id -> playerDays(id, now));
            int current = FriendStreakRules.effective(row.current(), row.lastSharedDay(), me, them);
            Integer next = StreakMilestones.next(StreakMilestones.FRIEND, current).map(Milestone::days).orElse(null);
            active.add(new FriendStreakDto(row.id().toString(), friend, current, row.best(),
                    me.activeOn(me.today()), them.activeOn(them.today()), next,
                    row.acceptedAt() != null ? row.acceptedAt() : row.createdAt()));
        }
        active.sort((x, y) -> Integer.compare(y.current(), x.current()));
        return new FriendStreaksResponse(active, incoming, outgoing, properties.maxFriendStreaks());
    }

    // --- Invitations ---------------------------------------------------------------------------

    @Transactional
    public FriendStreaksResponse invite(UUID userId, String friendCode) {
        User target = players.byFriendCode(friendCode);
        UUID partner = target.getId();
        if (partner.equals(userId)) {
            throw new ApiException(ErrorCode.CANNOT_TARGET_SELF, "This is your own friend code");
        }
        if (!friendships.areFriends(userId, partner)) {
            throw new ApiException(ErrorCode.NOT_FRIENDS, "Friend streaks are only between friends");
        }
        Instant now = now();
        Optional<Row> existing = streaks.between(userId, partner);
        if (existing.isPresent()) {
            Row row = existing.get();
            if (row.status() == Status.pending && row.requestedBy().equals(partner)) {
                activate(row, userId, now); // they invited first: accept
                return list(userId);
            }
            throw new ApiException(ErrorCode.FRIEND_STREAK_EXISTS, "A friend streak already exists with this player");
        }
        if (streaks.count(userId) >= properties.maxFriendStreaks()) {
            throw new ApiException(ErrorCode.FRIEND_STREAK_LIMIT_REACHED, "Too many friend streaks");
        }
        if (streaks.insertInvite(userId, partner, now)) {
            events.publishEvent(new FriendStreakInvitedEvent(userId, partner, now));
        }
        return list(userId);
    }

    @Transactional
    public FriendStreaksResponse accept(UUID userId, UUID streakId) {
        Row row = streaks.lock(streakId)
                .filter(r -> r.involves(userId) && r.status() == Status.pending && !r.requestedBy().equals(userId))
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "No pending invitation"));
        activate(row, userId, now());
        return list(userId);
    }

    /** Declines a received invitation, cancels a sent one, or ends an active friend streak. */
    @Transactional
    public FriendStreaksResponse remove(UUID userId, UUID streakId) {
        Row row = streaks.lock(streakId).filter(r -> r.involves(userId))
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "No such friend streak"));
        streaks.delete(row.id());
        return list(userId);
    }

    private void activate(Row row, UUID accepterId, Instant now) {
        for (UUID player : List.of(row.userA(), row.userB())) {
            if (streaks.countActive(player) >= properties.maxFriendStreaks()) {
                throw new ApiException(ErrorCode.FRIEND_STREAK_LIMIT_REACHED, "Too many friend streaks");
            }
        }
        streaks.activate(row.id(), now);
        // Both already played today: the first shared day counts right away.
        PlayerDays me = playerDays(accepterId, now);
        PlayerDays them = playerDays(row.partnerOf(accepterId), now);
        LocalDate today = me.today();
        if (me.activeOn(today) && them.activeOn(today)) {
            Row fresh = streaks.lock(row.id()).orElseThrow();
            countSharedDay(fresh, today, row.userA().equals(accepterId) ? me : them,
                    row.userA().equals(accepterId) ? them : me, now);
        }
    }

    // --- Counting --------------------------------------------------------------------------

    /**
     * Called inside the activity transaction after {@code userId} kept their streak on
     * {@code day} (their local date): every active friend streak whose partner also played on that
     * date gains a shared day.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void onActivity(UUID userId, LocalDate day, Instant now) {
        for (Row candidate : streaks.active(userId)) {
            UUID partner = candidate.partnerOf(userId);
            if (!friendships.areFriends(userId, partner)) {
                streaks.delete(candidate.id());
                continue;
            }
            Row row = streaks.lock(candidate.id()).orElse(null);
            if (row == null || row.status() != Status.active) {
                continue;
            }
            PlayerDays a = playerDays(row.userA(), now);
            PlayerDays b = playerDays(row.userB(), now);
            if (a.activeOn(day) && b.activeOn(day)) {
                countSharedDay(row, day, a, b, now);
            }
        }
    }

    private void countSharedDay(Row row, LocalDate day, PlayerDays a, PlayerDays b, Instant now) {
        if (row.lastSharedDay() != null && !day.isAfter(row.lastSharedDay())) {
            return;
        }
        int current = FriendStreakRules.afterSharedDay(row.current(), row.lastSharedDay(), day, a, b);
        int bestMilestone = row.bestMilestone();
        Optional<Milestone> milestone = StreakMilestones.exactly(StreakMilestones.FRIEND, current)
                .filter(m -> m.days() > row.bestMilestone());
        if (milestone.isPresent()) {
            bestMilestone = milestone.get().days();
            for (UUID player : List.of(row.userA(), row.userB())) {
                xp.ensure(player);
                rewards.grant(player, milestone.get().reward(), "friend_streak." + bestMilestone, now,
                        WalletSource.STREAK_MILESTONE);
            }
            events.publishEvent(new FriendStreakMilestoneEvent(row.id(), row.userA(), row.userB(), bestMilestone, now));
        }
        streaks.updateCount(row.id(), current, Math.max(row.best(), current), day, bestMilestone);
    }

    PlayerDays playerDays(UUID userId, Instant now) {
        ZoneId zone = calendar.zoneOf(userId);
        LocalDate today = PlayerCalendar.localDate(now, zone);
        State state = streakDays.find(userId).orElse(State.fresh());
        return new PlayerDays(state, streakDays.days(userId, today.minusDays(LOOKBACK_DAYS), today), today);
    }

    private FriendSummaryDto summary(UUID userId) {
        return jdbc.sql("""
                        select u.nickname, u.friend_code, coalesce(p.avatar_id, 'avatar.starter_1') as avatar_id
                        from users u left join profiles p on p.user_id = u.id where u.id = :id""")
                .param("id", userId)
                .query((rs, row) -> new FriendSummaryDto(rs.getString("nickname"), rs.getString("friend_code"),
                        rs.getString("avatar_id")))
                .single();
    }

    private Instant now() {
        return clock.instant().truncatedTo(ChronoUnit.MICROS);
    }
}
