package com.mandat.api.common.error;

/** Business error carrying a stable {@link ErrorCode}. The detail message is safe to show to clients. */
public class ApiException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final ErrorCode errorCode;

    public ApiException(ErrorCode errorCode, String detail) {
        super(detail);
        this.errorCode = errorCode;
    }

    public ApiException(ErrorCode errorCode) {
        this(errorCode, null);
    }

    public ErrorCode errorCode() {
        return errorCode;
    }
}
