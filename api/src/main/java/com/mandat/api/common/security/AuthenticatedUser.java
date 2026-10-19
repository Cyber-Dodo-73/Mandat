package com.mandat.api.common.security;

import java.util.UUID;

/** Principal of an authenticated request; controllers read it with {@code @AuthenticationPrincipal}. */
public record AuthenticatedUser(UUID id) {}
