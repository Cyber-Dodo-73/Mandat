package com.mandat.api.user.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;

/** Accepts the current terms of use; the player confirms the minimum age at the same time. */
public record AcceptTermsRequest(@NotNull @AssertTrue Boolean ageConfirmed) {}
