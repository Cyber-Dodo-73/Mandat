package com.mandat.api.auth;

import com.mandat.api.common.email.EmailSender;
import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.common.ratelimit.RateLimiter;
import com.mandat.api.user.User;
import com.mandat.api.user.UserService;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * "Forgot password": a single-use token valid 30 minutes, sent by email as a link to the reset
 * page. Only its SHA-256 is stored. Requesting a reset never reveals whether the email exists.
 */
@Service
class PasswordResetService {

    static final String FORGOT_IP = "auth-forgot-ip";
    static final String FORGOT_ACCOUNT = "auth-forgot-account";
    static final String RESET_IP = "auth-reset-ip";
    static final Duration TOKEN_TTL = Duration.ofMinutes(30);
    private static final int TOKEN_BYTES = 32;

    private final JdbcClient jdbc;
    private final UserService users;
    private final PasswordEncoder passwordEncoder;
    private final EmailSender email;
    private final SessionRevoker sessions;
    private final RateLimiter rateLimiter;
    private final Clock clock;
    private final String publicBaseUrl;
    private final SecureRandom random = new SecureRandom();

    PasswordResetService(JdbcClient jdbc, UserService users, PasswordEncoder passwordEncoder, EmailSender email,
            SessionRevoker sessions, RateLimiter rateLimiter, Clock clock,
            @Value("${mandat.public-base-url:https://mandat.cyber-dodo.fr}") String publicBaseUrl) {
        this.jdbc = jdbc;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.email = email;
        this.sessions = sessions;
        this.rateLimiter = rateLimiter;
        this.clock = clock;
        this.publicBaseUrl = publicBaseUrl.replaceAll("/+$", "");
    }

    @Transactional
    void requestReset(String rawEmail, String clientIp) {
        String normalized = rawEmail.strip().toLowerCase(Locale.ROOT);
        rateLimiter.consume(FORGOT_IP, clientIp);
        rateLimiter.consume(FORGOT_ACCOUNT, normalized);
        Optional<User> user = users.findByEmail(normalized).filter(u -> !u.isBanned());
        if (user.isEmpty()) {
            return;
        }
        UUID userId = user.get().getId();
        Instant now = clock.instant();
        // A new request invalidates the previous links.
        jdbc.sql("update password_reset_tokens set used_at = :now where user_id = :id and used_at is null")
                .param("now", Timestamp.from(now)).param("id", userId).update();
        byte[] bytes = new byte[TOKEN_BYTES];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        jdbc.sql("""
                insert into password_reset_tokens (user_id, token_hash, created_at, expires_at)
                values (:id, :hash, :now, :expires)
                """)
                .param("id", userId)
                .param("hash", RefreshTokenService.hash(token))
                .param("now", Timestamp.from(now))
                .param("expires", Timestamp.from(now.plus(TOKEN_TTL)))
                .update();
        boolean english = "en".equals(user.get().getLocale());
        String link = publicBaseUrl + "/reset-password?token=" + token + (english ? "&lang=en" : "");
        email.send(user.get().getEmail(),
                english ? "MANDAT: reset your password" : "MANDAT : réinitialise ton mot de passe",
                english
                        ? "Hello " + user.get().getNickname() + ",\n\nOpen this link within 30 minutes to choose a new "
                                + "password:\n" + link + "\n\nIf you did not ask for it, ignore this email."
                        : "Bonjour " + user.get().getNickname() + ",\n\nOuvre ce lien dans les 30 minutes pour choisir un "
                                + "nouveau mot de passe :\n" + link + "\n\nSi tu n'as rien demandé, ignore cet e-mail.");
    }

    @Transactional
    void reset(String token, String newPassword, String clientIp) {
        rateLimiter.consume(RESET_IP, clientIp);
        Instant now = clock.instant();
        UUID userId = jdbc.sql("""
                update password_reset_tokens set used_at = :now
                where token_hash = :hash and used_at is null and expires_at > :now
                returning user_id
                """)
                .param("now", Timestamp.from(now))
                .param("hash", RefreshTokenService.hash(token))
                .query(UUID.class)
                .optional()
                .orElseThrow(() -> new ApiException(ErrorCode.INVALID_RESET_TOKEN, "This reset link is invalid or expired"));
        users.resetPassword(userId, passwordEncoder.encode(newPassword));
        sessions.revokeAll(userId);
    }
}
