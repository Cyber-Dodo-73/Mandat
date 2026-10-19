package com.mandat.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.mandat.api.TestcontainersConfig;
import com.mandat.api.auth.social.SocialIdentity;
import com.mandat.api.auth.social.SocialTokenVerifier;
import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.user.SocialProvider;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfig.class)
class AuthFlowTests {

    private static final String PASSWORD = "correct horse battery";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcClient jdbc;

    @MockitoBean
    SocialTokenVerifier socialVerifier;

    @Test
    void registerThenReadMe() throws Exception {
        String email = uniqueEmail();
        String nickname = uniqueNickname();
        String body = register(email, nickname)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.newUser").value(true))
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

        mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearer(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.account.nickname").value(nickname))
                .andExpect(jsonPath("$.account.email").value(email))
                .andExpect(jsonPath("$.account.hasPassword").value(true))
                .andExpect(jsonPath("$.account.friendCode").value(matchesPattern("^[A-HJ-NP-Z2-9]{8}$")))
                .andExpect(jsonPath("$.settings.language").value("fr"))
                .andExpect(jsonPath("$.settings.reduceMotion").value("SYSTEM"))
                .andExpect(jsonPath("$.wallet.influence").value(0))
                .andExpect(jsonPath("$.wallet.bonusPacks").value(0));
    }

    @Test
    void passwordIsStoredAsArgon2Hash() throws Exception {
        String email = uniqueEmail();
        register(email, uniqueNickname()).andExpect(status().isCreated());
        String hash = jdbc.sql("select password_hash from users where email = cast(:email as citext)")
                .param("email", email).query(String.class).single();
        assertThat(hash).startsWith("$argon2id$").doesNotContain(PASSWORD);
    }

    @Test
    void duplicateEmailAndNicknameAreCaseInsensitive() throws Exception {
        String email = uniqueEmail();
        String nickname = uniqueNickname();
        register(email, nickname).andExpect(status().isCreated());

        register(email.toUpperCase(), uniqueNickname())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("email_taken"));
        register(uniqueEmail(), nickname.toUpperCase())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("nickname_taken"));
    }

    @Test
    void forbiddenNicknameIsRefused() throws Exception {
        register(uniqueEmail(), "H1tl3r_fan")
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("nickname_forbidden"));
    }

    @Test
    void invalidRegistrationReturnsValidationErrors() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"not-an-email\",\"password\":\"short\",\"nickname\":\"a\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("validation_failed"))
                .andExpect(jsonPath("$.errors.length()").value(3));
    }

    @Test
    void loginWithCorrectAndWrongPassword() throws Exception {
        String email = uniqueEmail();
        register(email, uniqueNickname()).andExpect(status().isCreated());

        login(email.toUpperCase(), PASSWORD).andExpect(status().isOk()).andExpect(jsonPath("$.newUser").value(false));
        login(email, "wrong password!").andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("invalid_credentials"));
        login(uniqueEmail(), PASSWORD).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("invalid_credentials"));
    }

    @Test
    void refreshRotatesAndReuseRevokesTheFamily() throws Exception {
        String first = register(uniqueEmail(), uniqueNickname()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        String firstRefresh = JsonPath.read(first, "$.refreshToken");

        String second = refresh(firstRefresh).andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        String secondRefresh = JsonPath.read(second, "$.refreshToken");
        assertThat(secondRefresh).isNotEqualTo(firstRefresh);

        // Replaying the used token is treated as theft: the whole family dies.
        refresh(firstRefresh).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("invalid_refresh_token"));
        refresh(secondRefresh).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("invalid_refresh_token"));
    }

    @Test
    void refreshIgnoresAnExpiredAccessTokenHeader() throws Exception {
        String body = register(uniqueEmail(), uniqueNickname()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer not-a-valid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json("refreshToken", JsonPath.read(body, "$.refreshToken"))))
                .andExpect(status().isOk());
    }

    @Test
    void logoutRevokesRefreshToken() throws Exception {
        String body = register(uniqueEmail(), uniqueNickname()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        String refreshToken = JsonPath.read(body, "$.refreshToken");

        mockMvc.perform(post("/api/v1/auth/logout").contentType(MediaType.APPLICATION_JSON)
                        .content(json("refreshToken", refreshToken)))
                .andExpect(status().isNoContent());
        refresh(refreshToken).andExpect(status().isUnauthorized());
        // Unknown tokens are accepted silently.
        mockMvc.perform(post("/api/v1/auth/logout").contentType(MediaType.APPLICATION_JSON)
                        .content(json("refreshToken", "unknown")))
                .andExpect(status().isNoContent());
    }

    @Test
    void updateSettingsPartially() throws Exception {
        String body = register(uniqueEmail(), uniqueNickname()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        mockMvc.perform(patch("/api/v1/me/settings").header(HttpHeaders.AUTHORIZATION, bearer(body))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"language\":\"en\",\"sound\":false,\"reduceMotion\":\"ON\",\"timezone\":\"America/Bogota\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.language").value("en"))
                .andExpect(jsonPath("$.sound").value(false))
                .andExpect(jsonPath("$.haptics").value(true))
                .andExpect(jsonPath("$.reduceMotion").value("ON"))
                .andExpect(jsonPath("$.timezone").value("America/Bogota"));

        mockMvc.perform(patch("/api/v1/me/settings").header(HttpHeaders.AUTHORIZATION, bearer(body))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"language\":\"de\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(patch("/api/v1/me/settings").header(HttpHeaders.AUTHORIZATION, bearer(body))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"timezone\":\"Mars/Olympus\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("validation_failed"));
    }

    @Test
    void deleteAccountRemovesDataAndTokens() throws Exception {
        String email = uniqueEmail();
        String body = register(email, uniqueNickname()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        String userId = JsonPath.read(body, "$.userId");

        mockMvc.perform(delete("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearer(body)))
                .andExpect(status().isNoContent());

        assertThat(jdbc.sql("select count(*) from users where id = :id").param("id", UUID.fromString(userId))
                .query(Long.class).single()).isZero();
        assertThat(jdbc.sql("select count(*) from refresh_tokens where user_id = :id")
                .param("id", UUID.fromString(userId)).query(Long.class).single()).isZero();
        refresh(JsonPath.read(body, "$.refreshToken")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearer(body)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("unauthorized"));
        login(email, PASSWORD).andExpect(status().isUnauthorized());
    }

    @Test
    void invalidBearerTokenReturnsProblemDetail() throws Exception {
        mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, "Bearer garbage"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("unauthorized"));
        mockMvc.perform(get("/api/v1/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("unauthorized"));
    }

    @Test
    void appleSignInCreatesThenReusesTheAccount() throws Exception {
        String subject = "apple-" + UUID.randomUUID();
        given(socialVerifier.verify(eq(SocialProvider.APPLE), eq("apple-token"), any()))
                .willReturn(new SocialIdentity(subject, null, false));

        String first = social("apple", "apple-token", "{}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.newUser").value(true))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        String userId = JsonPath.read(first, "$.userId");
        mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearer(first)))
                .andExpect(jsonPath("$.account.nickname").value(startsWith("Joueur")))
                .andExpect(jsonPath("$.account.hasPassword").value(false))
                .andExpect(jsonPath("$.account.linkedProviders[0]").value("APPLE"));

        social("apple", "apple-token", "{}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.newUser").value(false))
                .andExpect(jsonPath("$.userId").value(userId));
    }

    @Test
    void googleSignInWithVerifiedEmailLinksExistingAccount() throws Exception {
        String email = uniqueEmail();
        String registered = register(email, uniqueNickname()).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        String userId = JsonPath.read(registered, "$.userId");
        given(socialVerifier.verify(eq(SocialProvider.GOOGLE), eq("google-token"), any()))
                .willReturn(new SocialIdentity("google-" + UUID.randomUUID(), email, true));

        social("google", "google-token", "{}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.newUser").value(false))
                .andExpect(jsonPath("$.userId").value(userId));
    }

    @Test
    void socialSignInUsesTheRequestedNicknameWhenAllowed() throws Exception {
        String nickname = uniqueNickname();
        given(socialVerifier.verify(eq(SocialProvider.GOOGLE), eq("google-nick"), any()))
                .willReturn(new SocialIdentity("google-" + UUID.randomUUID(), uniqueEmail(), false));

        String body = social("google", "google-nick", "{\"nickname\":\"" + nickname + "\"}")
                .andExpect(jsonPath("$.newUser").value(true))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        mockMvc.perform(get("/api/v1/me").header(HttpHeaders.AUTHORIZATION, bearer(body)))
                .andExpect(jsonPath("$.account.nickname").value(nickname))
                // Unverified provider emails are never stored.
                .andExpect(jsonPath("$.account.email").doesNotExist());
    }

    @Test
    void rejectedSocialTokenReturnsProblemDetail() throws Exception {
        given(socialVerifier.verify(any(), anyString(), any()))
                .willThrow(new ApiException(ErrorCode.INVALID_SOCIAL_TOKEN, "Sign-in token was rejected"));
        social("apple", "forged", "{}")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("invalid_social_token"));
    }

    private ResultActions register(String email, String nickname) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\",\"nickname\":\"" + nickname
                        + "\"}"));
    }

    private ResultActions login(String email, String password) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"));
    }

    private ResultActions refresh(String refreshToken) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                .content(json("refreshToken", refreshToken)));
    }

    private ResultActions social(String provider, String idToken, String extraJson) throws Exception {
        String extra = extraJson.substring(1, extraJson.length() - 1);
        String body = "{\"idToken\":\"" + idToken + "\"" + (extra.isBlank() ? "" : "," + extra) + "}";
        return mockMvc.perform(post("/api/v1/auth/" + provider).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private static String bearer(String authResponse) {
        return "Bearer " + JsonPath.read(authResponse, "$.accessToken");
    }

    private static String json(String field, String value) {
        return "{\"" + field + "\":\"" + value + "\"}";
    }

    private static String uniqueEmail() {
        return "player-" + UUID.randomUUID() + "@example.com";
    }

    private static String uniqueNickname() {
        return "p" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }
}
