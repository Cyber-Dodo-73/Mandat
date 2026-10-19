package com.mandat.api.auth.social;

/** Identity extracted from a verified provider ID token. {@code email} is null when not shared. */
public record SocialIdentity(String subject, String email, boolean emailVerified) {}
