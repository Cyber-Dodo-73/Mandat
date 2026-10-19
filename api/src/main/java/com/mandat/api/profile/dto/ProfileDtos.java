package com.mandat.api.profile.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.mandat.api.card.CardFinish;
import com.mandat.api.user.NicknamePolicy;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;

public final class ProfileDtos {

    private ProfileDtos() {}

    public enum Visibility {
        PUBLIC("public"),
        PRIVATE("private");

        private final String key;

        Visibility(String key) {
            this.key = key;
        }

        @JsonValue
        public String key() {
            return key;
        }

        @JsonCreator
        public static Visibility fromKey(String key) {
            return Arrays.stream(values())
                    .filter(v -> v.key.equals(key))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Unknown visibility: " + key));
        }
    }

    /** A card of the collection shown on a profile. */
    public record CardRef(@NotBlank @Size(max = 32) String cardId, @NotNull CardFinish finish) {}

    public record ProfileStats(
            @Schema(description = "Distinct cards owned / cards in the season, 0–100") double collectionPercent,
            int distinctCards,
            int seasonCards,
            int packsOpened,
            int bestStreak,
            int level,
            int legendaryCards,
            int mythicCards,
            int duelWins) {}

    public record AchievementsSummary(int unlocked, int total, List<String> recent) {}

    /** What every viewer allowed to see the profile gets. */
    public record PublicProfile(
            String nickname,
            String friendCode,
            String avatarId,
            String bannerId,
            @Schema(nullable = true) String titleId,
            @Schema(nullable = true) CardRef favoriteCard,
            List<CardRef> showcase,
            ProfileStats stats,
            AchievementsSummary achievements,
            boolean friend) {}

    /** The cosmetics the player may pick from. */
    public record Unlocks(List<String> avatars, List<String> banners, List<String> titles) {}

    public record MyProfile(
            PublicProfile profile,
            Visibility visibility,
            Unlocks unlocks,
            @Schema(nullable = true, description = "Next time the nickname can be changed; null = now")
            Instant nicknameChangeAvailableAt) {}

    /** Full replacement of the editable profile settings. */
    public record UpdateProfileRequest(
            @NotBlank @Size(max = 64) String avatarId,
            @NotBlank @Size(max = 64) String bannerId,
            @Schema(nullable = true) @Size(max = 64) String titleId,
            @Schema(nullable = true) @Valid CardRef favoriteCard,
            @NotNull @Size(max = 6) List<@Valid @NotNull CardRef> showcase,
            @NotNull Visibility visibility) {}

    public record ChangeNicknameRequest(
            @NotBlank @Pattern(regexp = NicknamePolicy.FORMAT_REGEX) String nickname) {}

    public record CompareEntry(String cardId, List<CardFinish> finishes) {}

    /** Cards (with the owner's finishes) that one player owns and the other doesn't. */
    public record CompareResponse(
            String friendCode,
            List<CompareEntry> theyHaveYouDont,
            List<CompareEntry> youHaveTheyDont,
            int commonCards) {}
}
