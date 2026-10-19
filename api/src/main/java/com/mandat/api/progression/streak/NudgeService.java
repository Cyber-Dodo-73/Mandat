package com.mandat.api.progression.streak;

import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.common.events.FriendNudgedEvent;
import com.mandat.api.common.social.FriendActivityProvider;
import com.mandat.api.progression.PlayerCalendar;
import com.mandat.api.progression.streak.StreakDtos.NudgeResponse;
import com.mandat.api.social.FriendshipRepository;
import com.mandat.api.social.PlayerLookup;
import com.mandat.api.user.User;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "X te relance !": a player can nudge any friend who hasn't kept their streak today (in the
 * friend's local day), once per friend and local day of the sender, at most
 * {@code mandat.streak.max-nudges-per-day} per day. The push itself goes through the push module
 * (category "nudges", quiet hours, daily caps).
 */
@Service
public class NudgeService implements FriendActivityProvider {

    private final FriendshipRepository friendships;
    private final PlayerLookup players;
    private final PlayerCalendar calendar;
    private final StreakProperties properties;
    private final ApplicationEventPublisher events;
    private final JdbcClient jdbc;
    private final Clock clock;

    NudgeService(FriendshipRepository friendships, PlayerLookup players, PlayerCalendar calendar,
            StreakProperties properties, ApplicationEventPublisher events, JdbcClient jdbc, Clock clock) {
        this.friendships = friendships;
        this.players = players;
        this.calendar = calendar;
        this.properties = properties;
        this.events = events;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional
    public NudgeResponse nudge(UUID senderId, String friendCode) {
        User target = players.byFriendCode(friendCode);
        UUID receiverId = target.getId();
        if (receiverId.equals(senderId)) {
            throw new ApiException(ErrorCode.CANNOT_TARGET_SELF, "This is your own friend code");
        }
        if (!friendships.areFriends(senderId, receiverId)) {
            throw new ApiException(ErrorCode.NOT_FRIENDS, "You can only nudge your friends");
        }
        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        if (activeToday(receiverId, now)) {
            throw new ApiException(ErrorCode.FRIEND_ALREADY_ACTIVE, "This friend already kept their streak today");
        }
        LocalDate senderDay = PlayerCalendar.localDate(now, calendar.zoneOf(senderId));
        // Serialize the sender's nudges so the daily limit holds under concurrent requests.
        jdbc.sql("select id from users where id = :id for update").param("id", senderId).query(UUID.class).single();
        int sent = sentOn(senderId, senderDay);
        if (sent >= properties.maxNudgesPerDay()) {
            throw new ApiException(ErrorCode.NUDGE_LIMIT_REACHED, "No nudges left today");
        }
        boolean inserted = jdbc.sql("""
                        insert into friend_nudges (sender_id, receiver_id, sender_day, created_at)
                        values (:sender, :receiver, :day, :now) on conflict do nothing""")
                .param("sender", senderId).param("receiver", receiverId).param("day", Date.valueOf(senderDay))
                .param("now", Timestamp.from(now))
                .update() == 1;
        if (!inserted) {
            throw new ApiException(ErrorCode.NUDGE_ALREADY_SENT, "Already nudged this friend today");
        }
        events.publishEvent(new FriendNudgedEvent(senderId, receiverId, now));
        return new NudgeResponse(properties.maxNudgesPerDay() - sent - 1);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<UUID, FriendActivity> activity(UUID viewerId, Collection<UUID> friendIds) {
        Map<UUID, FriendActivity> result = new HashMap<>();
        if (friendIds.isEmpty()) {
            return result;
        }
        Instant now = clock.instant();
        LocalDate viewerDay = PlayerCalendar.localDate(now, calendar.zoneOf(viewerId));
        Set<UUID> nudged = new HashSet<>(jdbc.sql("""
                        select receiver_id from friend_nudges where sender_id = :id and sender_day = :day""")
                .param("id", viewerId).param("day", Date.valueOf(viewerDay)).query(UUID.class).list());
        List<UUID> ids = List.copyOf(friendIds);
        Map<UUID, Boolean> active = new HashMap<>();
        jdbc.sql("""
                        select u.id, u.timezone, p.last_active_day from users u
                        left join player_progress p on p.user_id = u.id where u.id in (:ids)""")
                .param("ids", ids)
                .query(rs -> {
                    Date last = rs.getDate("last_active_day");
                    LocalDate today = PlayerCalendar.localDate(now, PlayerCalendar.zone(rs.getString("timezone")));
                    active.put(rs.getObject("id", UUID.class), last != null && last.toLocalDate().equals(today));
                });
        for (UUID id : ids) {
            result.put(id, new FriendActivity(active.getOrDefault(id, false), nudged.contains(id)));
        }
        return result;
    }

    private boolean activeToday(UUID userId, Instant now) {
        LocalDate today = PlayerCalendar.localDate(now, calendar.zoneOf(userId));
        return jdbc.sql("select last_active_day from player_progress where user_id = :id")
                .param("id", userId).query(Date.class).optional()
                .map(d -> d.toLocalDate().equals(today)).orElse(false);
    }

    private int sentOn(UUID senderId, LocalDate day) {
        return jdbc.sql("select count(*) from friend_nudges where sender_id = :id and sender_day = :day")
                .param("id", senderId).param("day", Date.valueOf(day)).query(Integer.class).single();
    }
}
