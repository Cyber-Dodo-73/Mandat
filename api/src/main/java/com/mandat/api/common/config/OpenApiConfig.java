package com.mandat.api.common.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.security.SecurityScheme;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springdoc.core.customizers.OpenApiCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    public static final String BEARER_SCHEME = "bearerAuth";

    @Bean
    OpenAPI mandatOpenApi(MandatProperties properties) {
        return new OpenAPI()
                .info(new Info().title("MANDAT API").version(properties.apiVersion()))
                .components(new Components().addSecuritySchemes(BEARER_SCHEME, new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")));
    }

    /**
     * DTO fields are required by default so the generated TypeScript types are not all optional.
     * Mark a nullable field with {@code @Schema(nullable = true)} or {@code types = {"string", "null"}}.
     */
    @Bean
    OpenApiCustomizer requiredPropertiesCustomizer() {
        return openApi -> {
            openApi.setServers(null);
            if (openApi.getComponents() == null || openApi.getComponents().getSchemas() == null) {
                return;
            }
            openApi.getComponents().getSchemas().values().forEach(OpenApiConfig::markPropertiesRequired);
        };
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    private static void markPropertiesRequired(Schema schema) {
        Map<String, Schema> properties = schema.getProperties();
        if (properties == null || (schema.getRequired() != null && !schema.getRequired().isEmpty())) {
            return;
        }
        List<String> required = new ArrayList<>();
        properties.forEach((name, property) -> {
            boolean nullable = Boolean.TRUE.equals(property.getNullable())
                    || (property.getTypes() != null && property.getTypes().contains("null"));
            if (!nullable) {
                required.add(name);
            }
        });
        schema.setRequired(required);
    }
}
