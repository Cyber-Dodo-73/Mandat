package com.mandat.api.common.meta;

import com.mandat.api.common.config.MandatProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Clock;
import java.time.Instant;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/meta")
@Tag(name = "Meta", description = "Connectivity and server time")
public class MetaController {

    private final MandatProperties properties;
    private final Clock clock;

    public MetaController(MandatProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
    }

    @GetMapping
    @Operation(operationId = "getMeta", summary = "API name, version and authoritative server time")
    public MetaResponse getMeta() {
        return new MetaResponse(properties.appName(), properties.apiVersion(), Instant.now(clock));
    }

    public record MetaResponse(String appName, String apiVersion, Instant serverTime) {}
}
