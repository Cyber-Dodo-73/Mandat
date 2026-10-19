package com.mandat.api.common.ratelimit;

import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import java.time.Duration;

/** Mapped to a 429 ProblemDetail with a {@code Retry-After} header. */
public class RateLimitExceededException extends ApiException {

    private static final long serialVersionUID = 1L;

    private final Duration retryAfter;

    public RateLimitExceededException(Duration retryAfter) {
        super(ErrorCode.RATE_LIMITED, "Too many requests, retry later");
        this.retryAfter = retryAfter;
    }

    public Duration retryAfter() {
        return retryAfter;
    }
}
