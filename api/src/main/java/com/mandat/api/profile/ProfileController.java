package com.mandat.api.profile;

import com.mandat.api.common.config.OpenApiConfig;
import com.mandat.api.common.security.AuthenticatedUser;
import com.mandat.api.profile.dto.ProfileDtos.ChangeNicknameRequest;
import com.mandat.api.profile.dto.ProfileDtos.CompareResponse;
import com.mandat.api.profile.dto.ProfileDtos.MyProfile;
import com.mandat.api.profile.dto.ProfileDtos.PublicProfile;
import com.mandat.api.profile.dto.ProfileDtos.UpdateProfileRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Profile")
@SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
public class ProfileController {

    private final ProfileService profiles;

    public ProfileController(ProfileService profiles) {
        this.profiles = profiles;
    }

    @GetMapping("/profile/me")
    @Operation(summary = "My profile, its visibility and the cosmetics I can pick")
    public MyProfile mine(@AuthenticationPrincipal AuthenticatedUser user) {
        return profiles.mine(user.id());
    }

    @PutMapping("/profile/me")
    @Operation(summary = "Replace avatar, banner, title, favorite card, showcase (≤ 6 owned cards) and visibility")
    public MyProfile update(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody UpdateProfileRequest request) {
        return profiles.update(user.id(), request);
    }

    @PutMapping("/profile/me/nickname")
    @Operation(summary = "Change my nickname (moderated; first change free, then one every 30 days)")
    public MyProfile changeNickname(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody ChangeNicknameRequest request) {
        return profiles.changeNickname(user.id(), request.nickname());
    }

    @GetMapping("/profiles/{friendCode}")
    @Operation(summary = "A player's public profile (private profiles: friends only)")
    public PublicProfile view(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String friendCode) {
        return profiles.view(user.id(), friendCode);
    }

    @GetMapping("/profiles/{friendCode}/compare")
    @Operation(summary = "Compare collections: cards they have that I don't, and the reverse")
    public CompareResponse compare(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String friendCode) {
        return profiles.compare(user.id(), friendCode);
    }
}
