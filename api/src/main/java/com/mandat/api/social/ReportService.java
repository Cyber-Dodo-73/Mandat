package com.mandat.api.social;

import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.events.ReportFiledEvent;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.common.ratelimit.RateLimiter;
import com.mandat.api.social.dto.SocialDtos.ReportRequest;
import com.mandat.api.user.User;
import java.sql.Timestamp;
import java.time.Clock;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Stores profile reports for moderation; nothing of a report is ever shown to other players. */
@Service
public class ReportService {

    /** Rate-limit policy ({@code mandat.rate-limit.policies.report-user}), keyed by reporter. */
    public static final String RATE_LIMIT_POLICY = "report-user";

    private final JdbcClient jdbc;
    private final PlayerLookup players;
    private final RateLimiter rateLimiter;
    private final Clock clock;
    private final ApplicationEventPublisher events;

    ReportService(JdbcClient jdbc, PlayerLookup players, RateLimiter rateLimiter, Clock clock,
            ApplicationEventPublisher events) {
        this.jdbc = jdbc;
        this.players = players;
        this.rateLimiter = rateLimiter;
        this.clock = clock;
        this.events = events;
    }

    @Transactional
    public void report(UUID reporterId, ReportRequest request) {
        User target = players.byFriendCode(request.friendCode());
        if (target.getId().equals(reporterId)) {
            throw new ApiException(ErrorCode.CANNOT_TARGET_SELF, "You cannot report yourself");
        }
        rateLimiter.consume(RATE_LIMIT_POLICY, reporterId.toString());
        String note = request.note() == null || request.note().isBlank() ? null : request.note().strip();
        UUID reportId = jdbc.sql("""
                insert into reports (reporter_id, target_id, reason, note, created_at)
                values (:reporter, :target, :reason, :note, :now)
                returning id
                """)
                .param("reporter", reporterId)
                .param("target", target.getId())
                .param("reason", request.reason().key())
                .param("note", note)
                .param("now", Timestamp.from(clock.instant()))
                .query(UUID.class)
                .single();
        events.publishEvent(new ReportFiledEvent(reportId, request.reason().key(), clock.instant()));
    }
}
