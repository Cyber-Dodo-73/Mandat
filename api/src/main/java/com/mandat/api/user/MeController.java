package com.mandat.api.user;

import com.mandat.api.common.config.OpenApiConfig;
import com.mandat.api.common.security.AuthenticatedUser;
import com.mandat.api.common.wallet.WalletService;
import com.mandat.api.user.dto.MeResponse;
import com.mandat.api.user.dto.SettingsDto;
import com.mandat.api.user.dto.UpdateSettingsRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me")
@Tag(name = "Me", description = "The authenticated player's account, settings and summary")
@SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
public class MeController {

    private final UserService userService;
    private final WalletService walletService;
    private final List<MeContributor> contributors;
    private final Clock clock;

    public MeController(UserService userService, WalletService walletService, List<MeContributor> contributors,
            Clock clock) {
        this.userService = userService;
        this.walletService = walletService;
        this.contributors = contributors;
        this.clock = clock;
    }

    @GetMapping
    @Transactional(readOnly = true)
    @Operation(operationId = "getMe", summary = "Account, settings, wallet and the sections of other domains")
    public MeResponse getMe(@AuthenticationPrincipal AuthenticatedUser principal) {
        User user = userService.require(principal.id());
        WalletService.Balance balance = walletService.balance(user.getId());
        Map<String, Object> sections = new LinkedHashMap<>();
        contributors.forEach(contributor -> sections.put(contributor.key(), contributor.contribute(user.getId())));
        return new MeResponse(
                toAccount(user),
                SettingsDto.from(user),
                new MeResponse.Wallet(balance.influence(), balance.bonusPacks()),
                sections,
                Instant.now(clock));
    }

    @PatchMapping("/settings")
    @Operation(operationId = "updateMySettings", summary = "Partially update the player's settings")
    public SettingsDto updateSettings(@AuthenticationPrincipal AuthenticatedUser principal,
            @Valid @RequestBody UpdateSettingsRequest request) {
        return SettingsDto.from(userService.updateSettings(principal.id(), request));
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(operationId = "deleteMe", summary = "Permanently delete the account and all its data")
    public void deleteMe(@AuthenticationPrincipal AuthenticatedUser principal) {
        userService.delete(principal.id());
    }

    private static MeResponse.Account toAccount(User user) {
        List<String> providers = new ArrayList<>();
        if (user.getAppleSub() != null) {
            providers.add(SocialProvider.APPLE.name());
        }
        if (user.getGoogleSub() != null) {
            providers.add(SocialProvider.GOOGLE.name());
        }
        return new MeResponse.Account(
                user.getId(),
                user.getNickname(),
                user.getFriendCode(),
                user.getEmail(),
                user.getPasswordHash() != null,
                providers,
                user.getCreatedAt());
    }
}
