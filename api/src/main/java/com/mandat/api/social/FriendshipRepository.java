package com.mandat.api.social;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** One row per pair of players (any direction): pending request or accepted friendship. */
@Repository
public class FriendshipRepository {

    public enum Status { pending, accepted }

    record Link(UUID requesterId, UUID addresseeId, Status status) {}

    record FriendRow(UUID userId, String nickname, String friendCode, String avatarId, Instant since) {}

    private final JdbcClient jdbc;

    FriendshipRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public boolean areFriends(UUID a, UUID b) {
        return jdbc.sql("""
                select exists(select 1 from friendships where status = 'accepted'
                  and ((requester_id = :a and addressee_id = :b) or (requester_id = :b and addressee_id = :a)))
                """)
                .param("a", a)
                .param("b", b)
                .query(Boolean.class)
                .single();
    }

    Optional<Link> between(UUID a, UUID b) {
        return jdbc.sql("""
                select requester_id, addressee_id, status from friendships
                where (requester_id = :a and addressee_id = :b) or (requester_id = :b and addressee_id = :a)
                for update
                """)
                .param("a", a)
                .param("b", b)
                .query((rs, row) -> new Link(
                        rs.getObject("requester_id", UUID.class),
                        rs.getObject("addressee_id", UUID.class),
                        Status.valueOf(rs.getString("status"))))
                .optional();
    }

    /** False when a row already exists for the pair (concurrent request). */
    boolean insertRequest(UUID requester, UUID addressee, Instant now) {
        return jdbc.sql("""
                insert into friendships (requester_id, addressee_id, status, created_at) values (:r, :a, 'pending', :now)
                on conflict do nothing
                """)
                .param("r", requester)
                .param("a", addressee)
                .param("now", java.sql.Timestamp.from(now))
                .update() == 1;
    }

    void accept(UUID requester, UUID addressee, Instant now) {
        jdbc.sql("update friendships set status = 'accepted', accepted_at = :now where requester_id = :r and addressee_id = :a")
                .param("r", requester)
                .param("a", addressee)
                .param("now", java.sql.Timestamp.from(now))
                .update();
    }

    boolean delete(UUID a, UUID b) {
        return jdbc.sql("""
                delete from friendships
                where (requester_id = :a and addressee_id = :b) or (requester_id = :b and addressee_id = :a)
                """)
                .param("a", a)
                .param("b", b)
                .update() > 0;
    }

    int countAccepted(UUID userId) {
        return count("status = 'accepted' and (requester_id = :id or addressee_id = :id)", userId);
    }

    int countOutgoingPending(UUID userId) {
        return count("status = 'pending' and requester_id = :id", userId);
    }

    private int count(String where, UUID userId) {
        return jdbc.sql("select count(*) from friendships where " + where)
                .param("id", userId)
                .query(Integer.class)
                .single();
    }

    List<FriendRow> friends(UUID userId) {
        return list("""
                select u.id, u.nickname, u.friend_code, coalesce(p.avatar_id, 'avatar.starter_1') as avatar_id, f.accepted_at as since
                from friendships f
                join users u on u.id = case when f.requester_id = :id then f.addressee_id else f.requester_id end
                left join profiles p on p.user_id = u.id
                where f.status = 'accepted' and (f.requester_id = :id or f.addressee_id = :id)
                order by lower(u.nickname)
                """, userId);
    }

    List<FriendRow> incoming(UUID userId) {
        return list("""
                select u.id, u.nickname, u.friend_code, coalesce(p.avatar_id, 'avatar.starter_1') as avatar_id, f.created_at as since
                from friendships f join users u on u.id = f.requester_id
                left join profiles p on p.user_id = u.id
                where f.status = 'pending' and f.addressee_id = :id order by f.created_at desc
                """, userId);
    }

    List<FriendRow> outgoing(UUID userId) {
        return list("""
                select u.id, u.nickname, u.friend_code, coalesce(p.avatar_id, 'avatar.starter_1') as avatar_id, f.created_at as since
                from friendships f join users u on u.id = f.addressee_id
                left join profiles p on p.user_id = u.id
                where f.status = 'pending' and f.requester_id = :id order by f.created_at desc
                """, userId);
    }

    private List<FriendRow> list(String sql, UUID userId) {
        return jdbc.sql(sql)
                .param("id", userId)
                .query((rs, row) -> new FriendRow(
                        rs.getObject("id", UUID.class),
                        rs.getString("nickname"),
                        rs.getString("friend_code"),
                        rs.getString("avatar_id"),
                        rs.getTimestamp("since").toInstant()))
                .list();
    }
}
