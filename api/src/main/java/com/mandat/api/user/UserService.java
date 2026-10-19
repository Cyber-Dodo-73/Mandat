package com.mandat.api.user;

import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.user.dto.UpdateSettingsRequest;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    public static final Set<String> SUPPORTED_LANGUAGES = Set.of("fr", "en");
    public static final String DEFAULT_LANGUAGE = "fr";
    public static final String DEFAULT_TIMEZONE = "Europe/Paris";

    private static final int MAX_GENERATION_ATTEMPTS = 10;

    private final UserRepository users;
    private final NicknamePolicy nicknamePolicy;
    private final FriendCodeGenerator friendCodes;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public UserService(UserRepository users, NicknamePolicy nicknamePolicy, FriendCodeGenerator friendCodes, Clock clock) {
        this.users = users;
        this.nicknamePolicy = nicknamePolicy;
        this.friendCodes = friendCodes;
        this.clock = clock;
    }

    @Transactional
    public User createWithPassword(String email, String passwordHash, String nickname, String language, String timezone) {
        nicknamePolicy.requireAllowed(nickname);
        if (users.existsByEmail(email)) {
            throw new ApiException(ErrorCode.EMAIL_TAKEN, "An account already uses this email");
        }
        requireNicknameFree(nickname);
        User user = newUser(nickname, language, timezone);
        user.setEmail(email);
        user.setPasswordHash(passwordHash);
        return insert(user);
    }

    /**
     * Creates an account from a verified social identity. The requested nickname is used when it is
     * allowed and free; otherwise a neutral one is generated (the player can change it later).
     */
    @Transactional
    public User createForSocial(SocialProvider provider, String subject, String email, String requestedNickname,
            String language, String timezone) {
        String nickname = requestedNickname != null && nicknamePolicy.isAllowed(requestedNickname)
                && !users.existsByNickname(requestedNickname)
                ? requestedNickname
                : generateNickname(language);
        User user = newUser(nickname, language, timezone);
        if (email != null && !users.existsByEmail(email)) {
            user.setEmail(email);
        }
        setSubject(user, provider, subject);
        return insert(user);
    }

    @Transactional(readOnly = true)
    public Optional<User> findBySocialSubject(SocialProvider provider, String subject) {
        return switch (provider) {
            case APPLE -> users.findByAppleSub(subject);
            case GOOGLE -> users.findByGoogleSub(subject);
        };
    }

    @Transactional(readOnly = true)
    public Optional<User> findByEmail(String email) {
        return users.findByEmail(email);
    }

    /** Links a provider subject to an existing account (only called for provider-verified emails). */
    @Transactional
    public User linkSocial(UUID userId, SocialProvider provider, String subject) {
        User user = require(userId);
        setSubject(user, provider, subject);
        user.touch(Instant.now(clock));
        return user;
    }

    @Transactional(readOnly = true)
    public User require(UUID userId) {
        // A deleted account may still hold a valid access token for a few minutes.
        return users.findById(userId).orElseThrow(() -> new ApiException(ErrorCode.UNAUTHORIZED, "Account not found"));
    }

    @Transactional
    public User updateSettings(UUID userId, UpdateSettingsRequest request) {
        User user = require(userId);
        if (request.language() != null) {
            user.setLocale(request.language());
        }
        if (request.timezone() != null) {
            user.setTimezone(validTimezone(request.timezone()));
        }
        if (request.sound() != null) {
            user.setSoundEnabled(request.sound());
        }
        if (request.haptics() != null) {
            user.setHapticsEnabled(request.haptics());
        }
        if (request.notifications() != null) {
            user.setNotificationsEnabled(request.notifications());
        }
        if (request.reduceMotion() != null) {
            user.setReduceMotion(request.reduceMotion().toColumn());
        }
        user.touch(Instant.now(clock));
        return user;
    }

    /** Hard delete; every table referencing users(id) cascades (see V10__auth.sql). */
    @Transactional
    public void delete(UUID userId) {
        users.deleteById(userId);
    }

    private User newUser(String nickname, String language, String timezone) {
        String locale = language != null && SUPPORTED_LANGUAGES.contains(language) ? language : DEFAULT_LANGUAGE;
        return new User(nickname, uniqueFriendCode(), locale, safeTimezone(timezone), Instant.now(clock));
    }

    private User insert(User user) {
        try {
            return users.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            // Lost a race against a concurrent sign-up on a unique column.
            if (user.getEmail() != null && users.existsByEmail(user.getEmail())) {
                throw new ApiException(ErrorCode.EMAIL_TAKEN, "An account already uses this email");
            }
            if (users.existsByNickname(user.getNickname())) {
                throw new ApiException(ErrorCode.NICKNAME_TAKEN, "This nickname is already taken");
            }
            throw new ApiException(ErrorCode.CONFLICT, "Account could not be created, retry");
        }
    }

    private void requireNicknameFree(String nickname) {
        if (users.existsByNickname(nickname)) {
            throw new ApiException(ErrorCode.NICKNAME_TAKEN, "This nickname is already taken");
        }
    }

    private String uniqueFriendCode() {
        for (int attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
            String code = friendCodes.next();
            if (!users.existsByFriendCode(code)) {
                return code;
            }
        }
        throw new IllegalStateException("Could not generate a unique friend code");
    }

    private String generateNickname(String language) {
        String prefix = "en".equals(language) ? "Player" : "Joueur";
        for (int attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
            String candidate = prefix + (100_000 + random.nextInt(900_000));
            if (!users.existsByNickname(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Could not generate a unique nickname");
    }

    private static void setSubject(User user, SocialProvider provider, String subject) {
        switch (provider) {
            case APPLE -> user.setAppleSub(subject);
            case GOOGLE -> user.setGoogleSub(subject);
        }
    }

    private static String safeTimezone(String timezone) {
        try {
            return timezone == null ? DEFAULT_TIMEZONE : ZoneId.of(timezone).getId();
        } catch (DateTimeException e) {
            return DEFAULT_TIMEZONE;
        }
    }

    private static String validTimezone(String timezone) {
        try {
            return ZoneId.of(timezone).getId();
        } catch (DateTimeException e) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "Unknown timezone");
        }
    }
}
