package com.mandat.api.push;

import com.mandat.api.common.config.OpenApiConfig;
import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.common.security.AuthenticatedUser;
import com.mandat.api.push.dto.PushDtos.PushPreferencesDto;
import com.mandat.api.push.dto.PushDtos.PushPreferencesPatch;
import com.mandat.api.push.dto.PushDtos.RegisterDeviceRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.Clock;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/push")
@Tag(name = "Push notifications")
@SecurityRequirement(name = OpenApiConfig.BEARER_SCHEME)
public class PushController {

    private final PushDeviceRepository devices;
    private final PushPreferencesRepository preferences;
    private final Clock clock;

    PushController(PushDeviceRepository devices, PushPreferencesRepository preferences, Clock clock) {
        this.devices = devices;
        this.preferences = preferences;
        this.clock = clock;
    }

    @PostMapping("/devices")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Register or refresh this device's Expo push token")
    public void register(@AuthenticationPrincipal AuthenticatedUser user, @Valid @RequestBody RegisterDeviceRequest request) {
        devices.upsert(user.id(), request.token(), request.platform(), request.locale() == null ? "fr" : request.locale(),
                clock.instant().truncatedTo(ChronoUnit.MICROS));
    }

    @DeleteMapping("/devices/{token}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Unregister a push token (sign out, notifications turned off)")
    public void unregister(@AuthenticationPrincipal AuthenticatedUser user, @PathVariable String token) {
        if (!devices.delete(user.id(), token)) {
            throw new ApiException(ErrorCode.NOT_FOUND, "Unknown push token");
        }
    }

    @GetMapping("/preferences")
    @Operation(summary = "Push notification categories the player receives")
    public PushPreferencesDto preferences(@AuthenticationPrincipal AuthenticatedUser user) {
        return toDto(preferences.find(user.id()));
    }

    @PatchMapping("/preferences")
    @Transactional
    @Operation(summary = "Turn push categories on or off (marketing is off until explicitly turned on)")
    public PushPreferencesDto updatePreferences(@AuthenticationPrincipal AuthenticatedUser user,
            @RequestBody PushPreferencesPatch patch) {
        Map<PushCategory, Boolean> prefs = preferences.find(user.id());
        apply(prefs, PushCategory.BOOSTER_READY, patch.boosterReady());
        apply(prefs, PushCategory.STREAK, patch.streak());
        apply(prefs, PushCategory.FRIENDS, patch.friends());
        apply(prefs, PushCategory.EVENTS, patch.events());
        apply(prefs, PushCategory.MARKETING, patch.marketing());
        apply(prefs, PushCategory.NUDGES, patch.nudges());
        preferences.save(user.id(), prefs, clock.instant().truncatedTo(ChronoUnit.MICROS));
        return toDto(prefs);
    }

    private static void apply(Map<PushCategory, Boolean> prefs, PushCategory category, Boolean value) {
        if (value != null) {
            prefs.put(category, value);
        }
    }

    private static PushPreferencesDto toDto(Map<PushCategory, Boolean> prefs) {
        return new PushPreferencesDto(prefs.get(PushCategory.BOOSTER_READY), prefs.get(PushCategory.STREAK),
                prefs.get(PushCategory.FRIENDS), prefs.get(PushCategory.EVENTS), prefs.get(PushCategory.MARKETING),
                prefs.get(PushCategory.NUDGES));
    }
}
