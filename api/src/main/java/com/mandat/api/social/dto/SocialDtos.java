package com.mandat.api.social.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;

public final class SocialDtos {

    private SocialDtos() {}

    public record FriendDto(
            String nickname,
            String friendCode,
            String avatarId,
            Instant since,
            @Schema(description = "The friend kept their streak today (their local day); false for requests")
                    boolean activeToday,
            @Schema(description = "I already nudged this friend today (my local day)") boolean nudgedToday) {}

    public record FriendsResponse(
            List<FriendDto> friends,
            @Schema(description = "Requests other players sent to me") List<FriendDto> incoming,
            @Schema(description = "Requests I sent, not answered yet") List<FriendDto> outgoing,
            int maxFriends) {}

    public record AddFriendRequest(@NotBlank @Size(max = 16) String friendCode) {}

    public enum FriendRequestResult {
        /** A request was sent and waits for the other player. */
        REQUESTED("requested"),
        /** The other player had already asked: you are now friends. */
        ACCEPTED("accepted"),
        /** Already friends, or the request is already pending. */
        UNCHANGED("unchanged");

        private final String key;

        FriendRequestResult(String key) {
            this.key = key;
        }

        @JsonValue
        public String key() {
            return key;
        }
    }

    public record AddFriendResponse(FriendRequestResult result, FriendsResponse friends) {}

    public enum ReportReason {
        OFFENSIVE_NICKNAME("offensive_nickname"),
        INAPPROPRIATE_PROFILE("inappropriate_profile"),
        CHEATING("cheating"),
        HARASSMENT("harassment"),
        OTHER("other");

        private final String key;

        ReportReason(String key) {
            this.key = key;
        }

        @JsonValue
        public String key() {
            return key;
        }

        @JsonCreator
        public static ReportReason fromKey(String key) {
            return Arrays.stream(values())
                    .filter(r -> r.key.equals(key))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Unknown reason: " + key));
        }
    }

    public record ReportRequest(
            @NotBlank @Size(max = 16) String friendCode,
            @NotNull ReportReason reason,
            @Schema(nullable = true, description = "Private note for moderators") @Size(max = 280) String note) {}
}
