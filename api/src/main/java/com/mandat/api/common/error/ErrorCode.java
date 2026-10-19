package com.mandat.api.common.error;

import org.springframework.http.HttpStatus;

/** Stable error codes returned in ProblemDetail#code. The mobile app maps them to i18n keys. */
public enum ErrorCode {
    VALIDATION_FAILED("validation_failed", HttpStatus.BAD_REQUEST),
    MALFORMED_REQUEST("malformed_request", HttpStatus.BAD_REQUEST),
    UNAUTHORIZED("unauthorized", HttpStatus.UNAUTHORIZED),
    FORBIDDEN("forbidden", HttpStatus.FORBIDDEN),
    NOT_FOUND("not_found", HttpStatus.NOT_FOUND),
    METHOD_NOT_ALLOWED("method_not_allowed", HttpStatus.METHOD_NOT_ALLOWED),
    CONFLICT("conflict", HttpStatus.CONFLICT),
    RATE_LIMITED("rate_limited", HttpStatus.TOO_MANY_REQUESTS),

    // auth / user
    INVALID_CREDENTIALS("invalid_credentials", HttpStatus.UNAUTHORIZED),
    INVALID_REFRESH_TOKEN("invalid_refresh_token", HttpStatus.UNAUTHORIZED),
    INVALID_SOCIAL_TOKEN("invalid_social_token", HttpStatus.UNAUTHORIZED),
    EMAIL_TAKEN("email_taken", HttpStatus.CONFLICT),
    NICKNAME_TAKEN("nickname_taken", HttpStatus.CONFLICT),
    NICKNAME_FORBIDDEN("nickname_forbidden", HttpStatus.UNPROCESSABLE_CONTENT),

    // wallet / packs / collection
    INSUFFICIENT_INFLUENCE("insufficient_influence", HttpStatus.CONFLICT),
    NO_PACK_AVAILABLE("no_pack_available", HttpStatus.CONFLICT),
    PACK_LOCKED("pack_locked", HttpStatus.FORBIDDEN),
    IDEMPOTENCY_KEY_REUSED("idempotency_key_reused", HttpStatus.UNPROCESSABLE_CONTENT),
    CARD_NOT_OWNED("card_not_owned", HttpStatus.CONFLICT),
    NOT_ENOUGH_DUPLICATES("not_enough_duplicates", HttpStatus.CONFLICT),
    CARD_ALREADY_OWNED("card_already_owned", HttpStatus.CONFLICT),
    IDEMPOTENCY_KEY_REQUIRED("idempotency_key_required", HttpStatus.BAD_REQUEST),
    CRAFT_LIMIT_REACHED("craft_limit_reached", HttpStatus.CONFLICT),
    FINISH_UPGRADE_UNSUPPORTED("finish_upgrade_unsupported", HttpStatus.UNPROCESSABLE_CONTENT),

    // progression
    REWARD_NOT_CLAIMABLE("reward_not_claimable", HttpStatus.CONFLICT),
    REWARD_ALREADY_CLAIMED("reward_already_claimed", HttpStatus.CONFLICT),
    MISSION_EXPIRED("mission_expired", HttpStatus.CONFLICT),
    SEASON_TIER_NOT_FOUND("season_tier_not_found", HttpStatus.NOT_FOUND),

    // profile / social
    PROFILE_PRIVATE("profile_private", HttpStatus.FORBIDDEN),
    COSMETIC_LOCKED("cosmetic_locked", HttpStatus.FORBIDDEN),
    NICKNAME_CHANGE_TOO_SOON("nickname_change_too_soon", HttpStatus.CONFLICT),
    FRIEND_LIMIT_REACHED("friend_limit_reached", HttpStatus.CONFLICT),
    CANNOT_TARGET_SELF("cannot_target_self", HttpStatus.UNPROCESSABLE_CONTENT),

    // quiz / duel
    QUIZ_SESSION_FINISHED("quiz_session_finished", HttpStatus.CONFLICT),
    QUIZ_SESSION_EXPIRED("quiz_session_expired", HttpStatus.CONFLICT),
    QUIZ_ANSWER_OUT_OF_ORDER("quiz_answer_out_of_order", HttpStatus.CONFLICT),
    DUEL_FINISHED("duel_finished", HttpStatus.CONFLICT),
    DUEL_CARD_UNAVAILABLE("duel_card_unavailable", HttpStatus.CONFLICT),

    // streaks / friend streaks / nudges
    FREEZE_STOCK_FULL("freeze_stock_full", HttpStatus.CONFLICT),
    CURRENCY_UNAVAILABLE("currency_unavailable", HttpStatus.UNPROCESSABLE_CONTENT),
    STREAK_REPAIR_UNAVAILABLE("streak_repair_unavailable", HttpStatus.CONFLICT),
    NOT_FRIENDS("not_friends", HttpStatus.CONFLICT),
    FRIEND_STREAK_LIMIT_REACHED("friend_streak_limit_reached", HttpStatus.CONFLICT),
    FRIEND_STREAK_EXISTS("friend_streak_exists", HttpStatus.CONFLICT),
    NUDGE_ALREADY_SENT("nudge_already_sent", HttpStatus.CONFLICT),
    NUDGE_LIMIT_REACHED("nudge_limit_reached", HttpStatus.CONFLICT),
    FRIEND_ALREADY_ACTIVE("friend_already_active", HttpStatus.CONFLICT),
    INTERNAL_ERROR("internal_error", HttpStatus.INTERNAL_SERVER_ERROR);

    private final String code;
    private final HttpStatus status;

    ErrorCode(String code, HttpStatus status) {
        this.code = code;
        this.status = status;
    }

    public String code() {
        return code;
    }

    public HttpStatus status() {
        return status;
    }
}
