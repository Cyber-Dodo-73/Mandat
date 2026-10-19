package com.mandat.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/** Run through {@code ./gradlew exportOpenApi}: writes the spec used to generate the mobile client. */
@Tag("openapi")
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfig.class)
class OpenApiExportTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    void exportSpec() throws Exception {
        String spec = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        Path output = Path.of(System.getProperty("openapi.output", "build/openapi.json"));
        Files.writeString(output, spec, StandardCharsets.UTF_8);
    }
}
