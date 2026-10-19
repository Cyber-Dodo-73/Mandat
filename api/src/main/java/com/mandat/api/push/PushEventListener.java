package com.mandat.api.push;

import com.mandat.api.common.events.FriendAcceptedEvent;
import com.mandat.api.common.events.FriendRequestedEvent;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/** Social pushes, sent once the friendship change is committed. */
@Component
class PushEventListener {

    private final PushSender sender;
    private final PushDispatcher dispatcher;
    private final JdbcClient jdbc;

    PushEventListener(PushSender sender, PushDispatcher dispatcher, JdbcClient jdbc) {
        this.sender = sender;
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

    private String nickname(UUID userId) {
        return jdbc.sql("select nickname from users where id = :id")
                .param("id", userId).query(String.class).optional().orElse("?");
    }
}
