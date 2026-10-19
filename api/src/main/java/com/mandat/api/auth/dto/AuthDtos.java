package com.mandat.api.auth.dto;

import com.mandat.api.user.NicknamePolicy;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

/** Request and response bodies of the auth endpoints. */
public final class AuthDtos {

    private AuthDtos() {}

    public record RegisterRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(min = 8, max = 128) String password,
            @NotBlank @Pattern(regexp = NicknamePolicy.FORMAT_REGEX) String nickname,
            @Schema(nullable = true, allowableValues = {"fr", "en"}) @Pattern(regexp = "fr|en") String language,
            @Schema(nullable = true, example = "Europe/Paris") @Size(max = 64) String timezone,
            @Schema(nullable = true) @Size(max = 64) String deviceLabel,
            @Schema(description = "The player accepted the current terms of use and privacy policy")
            @NotNull @AssertTrue Boolean acceptTerms,
            @Schema(description = "The player confirmed meeting the minimum age (GET /api/v1/legal)")
            @NotNull @AssertTrue Boolean ageConfirmed) {

        @Override
        public String toString() {
            return "RegisterRequest[nickname=" + nickname + "]";
        }
    }

    public record LoginRequest(
            @NotBlank @Size(max = 254) String email,
            @NotBlank @Size(max = 128) String password,
            @Schema(nullable = true) @Size(max = 64) String deviceLabel) {

        @Override
        public String toString() {
            return "LoginRequest[]";
        }
    }

    public record RefreshRequest(@NotBlank @Size(max = 128) String refreshToken) {

        @Override
        public String toString() {
            return "RefreshRequest[]";
        }
    }

    public record LogoutRequest(@NotBlank @Size(max = 128) String refreshToken) {

        @Override
        public String toString() {
            return "LogoutRequest[]";
        }
    }

    public record SocialLoginRequest(
            @NotBlank @Size(max = 8192) String idToken,
            @Schema(nullable = true, description = "Raw nonce used for this sign-in, if any") @Size(max = 256)
            String nonce,
            @Schema(nullable = true, description = "Wished nickname for a new account")
            @Pattern(regexp = NicknamePolicy.FORMAT_REGEX) String nickname,
            @Schema(nullable = true, allowableValues = {"fr", "en"}) @Pattern(regexp = "fr|en") String language,
            @Schema(nullable = true, example = "Europe/Paris") @Size(max = 64) String timezone,
            @Schema(nullable = true) @Size(max = 64) String deviceLabel,
            @Schema(nullable = true, description = "Apple only: one-time authorization code, used to revoke the "
                    + "authorization when the account is deleted") @Size(max = 2048) String authorizationCode,
            @Schema(nullable = true, description = "True when the player accepted the current terms and confirmed "
                    + "the minimum age on this screen") Boolean acceptTerms) {

        @Override
        public String toString() {
            return "SocialLoginRequest[]";
        }
    }

    public record ForgotPasswordRequest(@NotBlank @Size(max = 254) String email) {

        @Override
        public String toString() {
            return "ForgotPasswordRequest[]";
        }
    }

    public record ResetPasswordRequest(
            @NotBlank @Size(max = 128) String token,
            @NotBlank @Size(min = 8, max = 128) String password) {

        @Override
        public String toString() {
            return "ResetPasswordRequest[]";
        }
    }

    public record AuthResponse(
            @Schema(allowableValues = "Bearer") String tokenType,
            String accessToken,
            Instant accessTokenExpiresAt,
            String refreshToken,
            Instant refreshTokenExpiresAt,
            UUID userId,
            @Schema(description = "True when this request created the account (e.g. first social sign-in)")
            boolean newUser) {

        @Override
        public String toString() {
            return "AuthResponse[userId=" + userId + ", newUser=" + newUser + "]";
        }
    }
}
