package com.mandat.api.push;

import com.mandat.api.common.events.FriendAcceptedEvent;
import com.mandat.api.common.events.FriendNudgedEvent;
import com.mandat.api.common.events.FriendRequestedEvent;
import com.mandat.api.common.events.FriendStreakInvitedEvent;
import com.mandat.api.common.events.FriendStreakMilestoneEvent;
import com.mandat.api.push.PushOutbox.Kind;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/** Social pushes, sent once the change is committed. */
@Component
class PushEventListener {

    private final PushSender sender;
    private final PushOutbox outbox;
    private final PushDispatcher dispatcher;
    private final JdbcClient jdbc;

    PushEventListener(PushSender sender, PushOutbox outbox, PushDispatcher dispatcher, JdbcClient jdbc) {
        this.sender = sender;
        this.outbox = outbox;
        this.dispatcher = dispatcher;
        this.jdbc = jdbc;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    void onFriendRequested(FriendRequestedEvent event) {
        String nickname = nickname(event.requesterId());
        dispatcher.dispatch(() -> sender.send(event.addresseeId(), new PushNotification.FriendRequest(nickname),
                "friend_request:" + event.requesterId() + ":" + event.at().toEpochMilli()));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    void onFriendAccepted(FriendAcceptedEvent event) {
        String nickname = nickname(event.accepterId());
        dispatcher.dispatch(() -> sender.send(event.requesterId(), new PushNotification.FriendAccepted(nickname),
                "friend_accepted:" + event.accepterId()));
    }

    /** Nudges wait for the end of the receiver's quiet hours instead of being dropped. */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    void onFriendNudged(FriendNudgedEvent event) {
        String nickname = nickname(event.senderId());
        dispatcher.dispatch(() -> outbox.enqueue(event.receiverId(), Kind.NUDGE, nickname, 0,
                "nudge:" + event.senderId() + ":" + event.at().toEpochMilli()));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    void onFriendStreakInvited(FriendStreakInvitedEvent event) {
        String nickname = nickname(event.inviterId());
        dispatcher.dispatch(() -> outbox.enqueue(event.inviteeId(), Kind.FRIEND_STREAK_INVITE, nickname, 0,
                "friend_streak_invite:" + event.inviterId() + ":" + event.at().toEpochMilli()));
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    void onFriendStreakMilestone(FriendStreakMilestoneEvent event) {
        String nicknameA = nickname(event.userA());
        String nicknameB = nickname(event.userB());
        String key = "friend_streak_milestone:" + event.streakId() + ":" + event.days();
        dispatcher.dispatch(() -> {
            outbox.enqueue(event.userA(), Kind.FRIEND_STREAK_MILESTONE, nicknameB, event.days(), key);
            outbox.enqueue(event.userB(), Kind.FRIEND_STREAK_MILESTONE, nicknameA, event.days(), key);
        });
    }

    private String nickname(UUID userId) {
        return jdbc.sql("select nickname from users where id = :id")
                .param("id", userId).query(String.class).optional().orElse("?");
    }
}
