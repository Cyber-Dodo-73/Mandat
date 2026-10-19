package com.mandat.api.social;

import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.social.dto.SocialDtos.BlockedPlayerDto;
import com.mandat.api.user.User;
import java.sql.Timestamp;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Blocking a player ends any friendship or pending request with them. Afterwards neither side can
 * see the other's profile, compare collections, send a friend request, a nudge or a friend-streak
 * invitation: those answer as if the code did not exist ({@link PlayerLookup#visibleTo}).
 */
@Service
public class BlockService {

    public static final int MAX_BLOCKS = 500;

    private final JdbcClient jdbc;
    private final PlayerLookup players;
    private final FriendshipRepository friendships;
    private final Clock clock;

    BlockService(JdbcClient jdbc, PlayerLookup players, FriendshipRepository friendships, Clock clock) {
        this.jdbc = jdbc;
        this.players = players;
        this.friendships = friendships;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<BlockedPlayerDto> list(UUID userId) {
        return jdbc.sql("""
                select u.nickname, u.friend_code, b.created_at
                from player_blocks b join users u on u.id = b.blocked_id
                where b.blocker_id = :me
                order by b.created_at desc
                """)
                .param("me", userId)
                .query((rs, n) -> new BlockedPlayerDto(rs.getString("nickname"), rs.getString("friend_code"),
                        rs.getTimestamp("created_at").toInstant()))
                .list();
    }

    @Transactional
    public List<BlockedPlayerDto> block(UUID userId, String friendCode) {
        User target = players.byFriendCode(friendCode);
        if (target.getId().equals(userId)) {
            throw new ApiException(ErrorCode.CANNOT_TARGET_SELF, "You cannot block yourself");
        }
        Integer count = jdbc.sql("select count(*) from player_blocks where blocker_id = :me")
                .param("me", userId).query(Integer.class).single();
        if (count >= MAX_BLOCKS) {
            throw new ApiException(ErrorCode.CONFLICT, "Too many blocked players");
        }
        jdbc.sql("""
                insert into player_blocks (blocker_id, blocked_id, created_at) values (:me, :other, :now)
                on conflict do nothing
                """)
                .param("me", userId)
                .param("other", target.getId())
                .param("now", Timestamp.from(clock.instant()))
                .update();
        friendships.delete(userId, target.getId());
        return list(userId);
    }

    @Transactional
    public List<BlockedPlayerDto> unblock(UUID userId, String friendCode) {
        User target = players.byFriendCode(friendCode);
        jdbc.sql("delete from player_blocks where blocker_id = :me and blocked_id = :other")
                .param("me", userId)
                .param("other", target.getId())
                .update();
        return list(userId);
    }
}
