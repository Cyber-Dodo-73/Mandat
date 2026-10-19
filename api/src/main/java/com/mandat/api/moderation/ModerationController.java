package com.mandat.api.moderation;

import com.mandat.api.common.config.OpenApiConfig;
import com.mandat.api.common.security.AuthenticatedUser;
import com.mandat.api.moderation.dto.ModerationDtos.BanRequest;
import com.mandat.api.moderation.dto.ModerationDtos.ModeratedPlayer;
import com.mandat.api.moderation.dto.ModerationDtos.ReportsResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Moderation back office (admin role only; 403 for everybody else). */
@RestController
@RequestMapping("/api/v1/admin")
@Tag(name = "Admin", description = "Moderation: reports, bans, forced renames (admin role only)")
@SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
public class ModerationController {

    private final ModerationService moderation;

    ModerationController(ModerationService moderation) {
        this.moderation = moderation;
    }

    @GetMapping("/reports")
    @Operation(operationId = "adminListReports", summary = "Latest reports (open ones only by default)")
    public ReportsResponse reports(@AuthenticationPrincipal AuthenticatedUser user,
            @RequestParam(defaultValue = "true") boolean openOnly) {
        return new ReportsResponse(moderation.reports(user.id(), openOnly));
    }

    @PostMapping("/reports/{reportId}/handled")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(operationId = "adminHandleReport", summary = "Mark a report as handled (reviewed, or dismissed)")
    public void handle(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable UUID reportId,
            @RequestParam(defaultValue = "false") boolean dismissed) {
        moderation.handle(user.id(), reportId, dismissed);
    }

    @PostMapping("/players/{friendCode}/ban")
    @Operation(operationId = "adminBanPlayer", summary = "Ban a player: no sign-in, sessions ended, profile hidden")
    public ModeratedPlayer ban(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String friendCode,
            @Valid @RequestBody BanRequest request) {
        return moderation.ban(user.id(), friendCode, request.reason());
    }

    @DeleteMapping("/players/{friendCode}/ban")
    @Operation(operationId = "adminUnbanPlayer", summary = "Lift a ban")
    public ModeratedPlayer unban(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String friendCode) {
        return moderation.unban(user.id(), friendCode);
    }

    @PostMapping("/players/{friendCode}/rename")
    @Operation(operationId = "adminRenamePlayer", summary = "Replace a nickname by a generated one")
    public ModeratedPlayer rename(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String friendCode) {
        return moderation.forceRename(user.id(), friendCode);
    }
}
