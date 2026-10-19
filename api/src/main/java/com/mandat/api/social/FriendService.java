package com.mandat.api.social;

import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.events.FriendAcceptedEvent;
import com.mandat.api.common.events.FriendRequestedEvent;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.social.FriendshipRepository.FriendRow;
import com.mandat.api.social.FriendshipRepository.Link;
import com.mandat.api.social.FriendshipRepository.Status;
import com.mandat.api.social.dto.SocialDtos.AddFriendResponse;
import com.mandat.api.social.dto.SocialDtos.FriendDto;
import com.mandat.api.social.dto.SocialDtos.FriendRequestResult;
import com.mandat.api.social.dto.SocialDtos.FriendsResponse;
import com.mandat.api.user.User;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Mutual-request friendships: adding a friend code sends a request; the other player accepts it
 * by adding your code back (or with the accept endpoint). Removing deletes the friendship or
 * cancels / declines the pending request.
 */
@Service
public class FriendService {

    public static final int MAX_FRIENDS = 200;
    public static final int MAX_PENDING_REQUESTS = 50;

    private final FriendshipRepository friendships;
    private final PlayerLookup players;
    private final Clock clock;
    private final ApplicationEventPublisher events;

    FriendService(FriendshipRepository friendships, PlayerLookup players, Clock clock, ApplicationEventPublisher events) {
        this.friendships = friendships;
        this.players = players;
        this.clock = clock;
        this.events = events;
    }

    @Transactional(readOnly = true)
    public FriendsResponse list(UUID userId) {
        return new FriendsResponse(
                dtos(friendships.friends(userId)),
                dtos(friendships.incoming(userId)),
                dtos(friendships.outgoing(userId)),
                MAX_FRIENDS);
    }

    @Transactional
    public AddFriendResponse add(UUID userId, String friendCode) {
        User target = players.byFriendCode(friendCode);
        if (target.getId().equals(userId)) {
            throw new ApiException(ErrorCode.CANNOT_TARGET_SELF, "This is your own friend code");
        }
        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        Optional<Link> existing = friendships.between(userId, target.getId());
        FriendRequestResult result;
        if (existing.isEmpty()) {
            requireRoomForFriend(userId);
            if (friendships.countOutgoingPending(userId) >= MAX_PENDING_REQUESTS) {
                throw new ApiException(ErrorCode.FRIEND_LIMIT_REACHED, "Too many pending friend requests");
            }
            result = friendships.insertRequest(userId, target.getId(), now)
                    ? FriendRequestResult.REQUESTED
                    : FriendRequestResult.UNCHANGED;
            if (result == FriendRequestResult.REQUESTED) {
                events.publishEvent(new FriendRequestedEvent(userId, target.getId(), now));
            }
        } else if (existing.get().status() == Status.pending && existing.get().addresseeId().equals(userId)) {
            accept(existing.get(), now);
            result = FriendRequestResult.ACCEPTED;
        } else {
            result = FriendRequestResult.UNCHANGED;
        }
        return new AddFriendResponse(result, list(userId));
    }

    /** Accepts a pending request received from {@code friendCode}. */
    @Transactional
    public FriendsResponse accept(UUID userId, String friendCode) {
        User requester = players.byFriendCode(friendCode);
        Link link = friendships.between(userId, requester.getId())
                .filter(l -> l.status() == Status.pending && l.addresseeId().equals(userId))
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "No pending request from this player"));
        accept(link, clock.instant().truncatedTo(ChronoUnit.MICROS));
        return list(userId);
    }

    /** Removes a friend, cancels a sent request or declines a received one. */
    @Transactional
    public FriendsResponse remove(UUID userId, String friendCode) {
        User other = players.byFriendCode(friendCode);
        if (!friendships.delete(userId, other.getId())) {
            throw new ApiException(ErrorCode.NOT_FOUND, "Not a friend nor a pending request");
        }
        return list(userId);
    }

    private void accept(Link link, Instant now) {
        requireRoomForFriend(link.requesterId());
        requireRoomForFriend(link.addresseeId());
        friendships.accept(link.requesterId(), link.addresseeId(), now);
        events.publishEvent(new FriendAcceptedEvent(link.requesterId(), link.addresseeId(), now));
    }

    private void requireRoomForFriend(UUID userId) {
        if (friendships.countAccepted(userId) >= MAX_FRIENDS) {
            throw new ApiException(ErrorCode.FRIEND_LIMIT_REACHED, "Friend list is full");
        }
    }

    private static List<FriendDto> dtos(List<FriendRow> rows) {
        return rows.stream().map(r -> new FriendDto(r.nickname(), r.friendCode(), r.avatarId(), r.since())).toList();
    }
}
