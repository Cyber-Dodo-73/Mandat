package com.mandat.api.social;

import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.user.User;
import com.mandat.api.user.UserRepository;
import java.util.Locale;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Resolves the friend codes players share (case-insensitive, surrounding spaces ignored). */
@Component
public class PlayerLookup {

    private final UserRepository users;
    private final JdbcClient jdbc;

    PlayerLookup(UserRepository users, JdbcClient jdbc) {
        this.users = users;
        this.jdbc = jdbc;
    }

    /** @throws ApiException {@link ErrorCode#NOT_FOUND} for an unknown code */
    public User byFriendCode(String friendCode) {
        String normalized = friendCode == null ? "" : friendCode.strip().toUpperCase(Locale.ROOT);
        return users.findByFriendCode(normalized)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "No player with this friend code"));
    }

    /**
     * Like {@link #byFriendCode} for interactions (profile, compare, friend request, nudge, friend
     * streak): a banned player, or one on either side of a block, answers as an unknown code so a
     * block is never revealed.
     */
    public User visibleTo(UUID viewerId, String friendCode) {
        User target = byFriendCode(friendCode);
        if (target.getId().equals(viewerId)) {
            return target;
        }
        if (target.isBanned() || blockedEitherWay(viewerId, target.getId())) {
            throw new ApiException(ErrorCode.NOT_FOUND, "No player with this friend code");
        }
        return target;
    }

    public boolean blockedEitherWay(UUID a, UUID b) {
        return jdbc.sql("""
                select exists (select 1 from player_blocks
                               where (blocker_id = :a and blocked_id = :b) or (blocker_id = :b and blocked_id = :a))
                """)
                .param("a", a)
                .param("b", b)
                .query(Boolean.class)
                .single();
    }
}
