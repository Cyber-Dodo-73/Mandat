package com.mandat.api.support;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;

import com.mandat.api.common.security.AuthenticatedUser;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

public final class GameTestSupport {

    private GameTestSupport() {}

    public static UUID newUser(JdbcClient jdbc) {
        UUID id = UUID.randomUUID();
        jdbc.sql("insert into users (id) values (:id)").param("id", id).update();
        return id;
    }

    public static RequestPostProcessor as(UUID userId) {
        return authentication(new UsernamePasswordAuthenticationToken(new AuthenticatedUser(userId), null, List.of()));
    }

    public static int influence(JdbcClient jdbc, UUID userId) {
        return jdbc.sql("select influence from users where id = :id").param("id", userId).query(Integer.class).single();
    }

    public static void setInfluence(JdbcClient jdbc, UUID userId, int influence) {
        jdbc.sql("update users set influence = :influence where id = :id")
                .param("influence", influence).param("id", userId).update();
    }
}
