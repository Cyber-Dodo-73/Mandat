package com.mandat.api.progression.streak;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import com.mandat.api.progression.RewardDto;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

public final class StreakDtos {

    private StreakDtos() {}

    // --- Individual streak ------------------------------------------------------------------

    public record MilestoneDto(
            int days,
            @Schema(description = "Already reached (rewards are granted once per lifetime)") boolean reached,
            RewardDto reward,
            @Schema(description = "Streak freezes added to the inventory") int freezes) {}

    public record NextMilestoneDto(int days, @Schema(description = "Days left to reach it") int remaining, RewardDto reward, int freezes) {}

    public record FreezePricesDto(
            int influence,
            @Schema(types = {"integer", "null"}, description = "Price in Sceaux, null while the premium currency isn't available")
                    Integer sceaux) {}

    public record RepairDto(
            boolean available,
            @Schema(types = {"integer", "null"}, description = "Streak after the repair") Integer restoresTo,
            @Schema(types = {"string", "null"}, format = "date-time", description = "End of the repair window (player's midnight)")
                    Instant expiresAt,
            @Schema(description = "This month's repair is already used") boolean usedThisMonth) {}

    public record StreakResponse(
            @Schema(description = "Streak as of today (0 when broken)") int current,
            int best,
            @Schema(description = "A streak activity was already done today") boolean activeToday,
            @Schema(description = "Player's local date") LocalDate today,
            String timezone,
            @Schema(description = "Next local midnight: today's activity must happen before it") Instant dayEndsAt,
            @Schema(description = "Streak freezes in stock (this week's free one included)") int freezes,
            int maxFreezes,
            FreezePricesDto freezePrices,
            int influence,
            List<MilestoneDto> milestones,
            @Schema(nullable = true) NextMilestoneDto nextMilestone,
            RepairDto repair) {}

    public enum DayStatusDto {
        /** A streak activity was done that day. */
        ACTIVE("active"),
        /** Protected by a freeze or a repair. */
        FROZEN("frozen"),
        /** Not kept: the streak broke (or no streak was running). */
        MISSED("missed"),
        /** Today, nothing done yet. */
        TODAY("today"),
        /** Before the player's first streak day. */
        NONE("none");

        private final String key;

        DayStatusDto(String key) {
            this.key = key;
        }

        @JsonValue
        public String key() {
            return key;
        }
    }

    public record StreakDayDto(LocalDate date, DayStatusDto status) {}

    public record StreakHistoryResponse(LocalDate from, LocalDate to, List<StreakDayDto> days) {}

    public enum Currency {
        INFLUENCE("influence"),
        SCEAUX("sceaux");

        private final String key;

        Currency(String key) {
            this.key = key;
        }

        @JsonValue
        public String key() {
            return key;
        }

        @JsonCreator
        public static Currency fromKey(String key) {
            return Arrays.stream(values()).filter(c -> c.key.equals(key)).findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Unknown currency: " + key));
        }
    }

    public record PurchaseFreezeRequest(@NotNull Currency currency) {}

    public record PurchaseFreezeResponse(Currency currency, int price, int freezes, int maxFreezes, int influence) {}

    // --- Friend streaks & nudges --------------------------------------------------------------

    public record FriendSummaryDto(String nickname, String friendCode, String avatarId) {}

    public record FriendStreakDto(
            String id,
            FriendSummaryDto friend,
            @Schema(description = "Shared streak as of today (0 when broken)") int current,
            int best,
            @Schema(description = "I kept my streak today (my local day)") boolean meDoneToday,
            @Schema(description = "The friend kept theirs today (their local day)") boolean friendDoneToday,
            @Schema(types = {"integer", "null"}) Integer nextMilestone,
            Instant since) {}

    public record FriendStreakInviteDto(String id, FriendSummaryDto friend, Instant at) {}

    public record FriendStreaksResponse(
            List<FriendStreakDto> streaks,
            @Schema(description = "Invitations I received") List<FriendStreakInviteDto> incoming,
            @Schema(description = "Invitations I sent") List<FriendStreakInviteDto> outgoing,
            int maxFriendStreaks) {}

    public record InviteFriendStreakRequest(@NotBlank @Size(max = 16) String friendCode) {}

    public record NudgeResponse(@Schema(description = "Nudges I can still send today") int remainingToday) {}
}
