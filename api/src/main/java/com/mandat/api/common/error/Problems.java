package com.mandat.api.common.error;

import org.springframework.http.ProblemDetail;

/** Builds ProblemDetail bodies with the stable {@code code} property. */
public final class Problems {

    public static final String CODE_PROPERTY = "code";
    public static final String ERRORS_PROPERTY = "errors";

    private Problems() {}

    public static ProblemDetail of(ErrorCode errorCode, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(errorCode.status(), detail);
        problem.setProperty(CODE_PROPERTY, errorCode.code());
        return problem;
    }
}
