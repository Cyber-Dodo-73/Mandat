package com.mandat.api.moderation;

import com.mandat.api.auth.SessionRevoker;
import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.moderation.dto.ModerationDtos.ModeratedPlayer;
import com.mandat.api.moderation.dto.ModerationDtos.ReportDto;
import com.mandat.api.social.PlayerLookup;
import com.mandat.api.user.User;
import com.mandat.api.user.UserService;
import java.sql.Timestamp;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Moderator actions, reserved to accounts with the {@code admin} role (granted in the database:
 * {@code update users set role = 'admin' where friend_code = '…'}). Every action is logged with
 * the moderator id.
 */
@Service
class ModerationService {

    private static final Logger log = LoggerFactory.getLogger(ModerationService.class);
    private static final int PAGE_SIZE = 100;

    private final JdbcClient jdbc;
    private final UserService users;
    private final PlayerLookup players;
    private final SessionRevoker sessions;
    private final Clock clock;

    ModerationService(JdbcClient jdbc, UserService users, PlayerLookup players, SessionRevoker sessions, Clock clock) {
        this.jdbc = jdbc;
        this.users = users;
        this.players = players;
        this.sessions = sessions;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    List<ReportDto> reports(UUID moderatorId, boolean openOnly) {
        requireAdmin(moderatorId);
        return jdbc.sql("""
                select r.id, r.reason, r.note, r.status, r.created_at, r.handled_at, r.resolution,
                       t.nickname as target_nickname, t.friend_code as target_code, t.banned_at is not null as banned,
                       rep.friend_code as reporter_code
                from reports r
                join users t on t.id = r.target_id
                join users rep on rep.id = r.reporter_id
                where (:openOnly = false or r.status = 'open')
                order by r.created_at desc
                limit :limit
                """)
                .param("openOnly", openOnly)
                .param("limit", PAGE_SIZE)
                .query((rs, n) -> new ReportDto(
                        rs.getObject("id", UUID.class),
                        rs.getString("reason"),
                        rs.getString("note"),
                        rs.getString("status"),
                        rs.getTimestamp("created_at").toInstant(),
                        rs.getString("target_nickname"),
                        rs.getString("target_code"),
                        rs.getBoolean("banned"),
                        rs.getString("reporter_code"),
                        rs.getTimestamp("handled_at") == null ? null : rs.getTimestamp("handled_at").toInstant(),
                        rs.getString("resolution")))
                .list();
    }

    /** Closes a report without action (dismissed) or as reviewed. */
    @Transactional
    void handle(UUID moderatorId, UUID reportId, boolean dismissed) {
        requireAdmin(moderatorId);
        int updated = jdbc.sql("""
                update reports set status = :status, handled_at = :now, handled_by = :by,
                                   resolution = coalesce(resolution, 'none')
                where id = :id
                """)
                .param("status", dismissed ? "dismissed" : "reviewed")
                .param("now", Timestamp.from(clock.instant()))
                .param("by", moderatorId)
                .param("id", reportId)
                .update();
        if (updated == 0) {
            throw new ApiException(ErrorCode.NOT_FOUND, "No such report");
        }
        log.info("Moderation: report {} handled by {}", reportId, moderatorId);
    }

    /** Disables sign-in, ends every session and hides the profile; closes the player's open reports. */
    @Transactional
    ModeratedPlayer ban(UUID moderatorId, String friendCode, String reason) {
        requireAdmin(moderatorId);
        User target = target(moderatorId, friendCode);
        users.ban(target.getId(), reason.strip());
        sessions.revokeAll(target.getId());
        closeOpenReports(moderatorId, target.getId(), "banned");
        log.info("Moderation: player {} banned by {}", target.getId(), moderatorId);
        return moderated(target.getId());
    }

    @Transactional
    ModeratedPlayer unban(UUID moderatorId, String friendCode) {
        requireAdmin(moderatorId);
        User target = target(moderatorId, friendCode);
        users.unban(target.getId());
        log.info("Moderation: player {} unbanned by {}", target.getId(), moderatorId);
        return moderated(target.getId());
    }

    /** Replaces the nickname by a generated one; the player can pick a new one later. */
    @Transactional
    ModeratedPlayer forceRename(UUID moderatorId, String friendCode) {
        requireAdmin(moderatorId);
        User target = target(moderatorId, friendCode);
        users.forceRename(target.getId());
        closeOpenReports(moderatorId, target.getId(), "renamed");
        log.info("Moderation: player {} renamed by {}", target.getId(), moderatorId);
        return moderated(target.getId());
    }

    private User target(UUID moderatorId, String friendCode) {
        User target = players.byFriendCode(friendCode);
        if (target.getId().equals(moderatorId)) {
            throw new ApiException(ErrorCode.CANNOT_TARGET_SELF, "You cannot moderate yourself");
        }
        return target;
    }

    private void closeOpenReports(UUID moderatorId, UUID targetId, String resolution) {
        jdbc.sql("""
                update reports set status = 'reviewed', handled_at = :now, handled_by = :by, resolution = :resolution
                where target_id = :target and status = 'open'
                """)
                .param("now", Timestamp.from(clock.instant()))
                .param("by", moderatorId)
                .param("resolution", resolution)
                .param("target", targetId)
                .update();
    }

    private ModeratedPlayer moderated(UUID userId) {
        User user = users.require(userId);
        return new ModeratedPlayer(user.getNickname(), user.getFriendCode(), user.isBanned());
    }

    private void requireAdmin(UUID userId) {
        if (!users.require(userId).isAdmin()) {
            throw new ApiException(ErrorCode.FORBIDDEN, "Moderators only");
        }
    }
}
