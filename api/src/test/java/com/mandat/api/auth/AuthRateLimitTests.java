package com.mandat.api.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.mandat.api.TestcontainersConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {
    "mandat.rate-limit.policies.auth-login-ip.capacity=100",
    "mandat.rate-limit.policies.auth-login-account.capacity=2",
    "mandat.rate-limit.policies.auth-login-account.period=PT1H"
})
@AutoConfigureMockMvc
@Import(TestcontainersConfig.class)
class AuthRateLimitTests {

    @Autowired
    MockMvc mockMvc;

    @Test
    void loginIsRateLimitedPerAccount() throws Exception {
        String body = "{\"email\":\"target@example.com\",\"password\":\"guess-guess\"}";
        for (int i = 0; i < 2; i++) {
            mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isUnauthorized());
        }
        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.code").value("rate_limited"));
        // Another account is not affected.
        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"other@example.com\",\"password\":\"guess-guess\"}"))
                .andExpect(status().isUnauthorized());
    }
}
