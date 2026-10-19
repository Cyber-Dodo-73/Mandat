package com.mandat.api.common.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "mandat")
public record MandatProperties(
        @DefaultValue("MANDAT") String appName,
        @DefaultValue("v1") String apiVersion,
        @DefaultValue Cors cors) {

    public record Cors(@DefaultValue List<String> allowedOrigins) {}
}
