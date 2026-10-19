package com.mandat.api.progression;

import com.mandat.api.common.config.OpenApiConfig;
import com.mandat.api.common.security.AuthenticatedUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/progression")
@Tag(name = "Progression", description = "Level, XP, streak and wallet summary")
@SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
public class ProgressionController {

    private final ProgressionSummaryService summaries;

    public ProgressionController(ProgressionSummaryService summaries) {
        this.summaries = summaries;
    }

    @GetMapping
    @Operation(operationId = "getProgression", summary = "Level, XP, streak, resets and wallet of the player")
    public ProgressionResponse getProgression(@AuthenticationPrincipal AuthenticatedUser user) {
        return summaries.summary(user.id());
    }
}
