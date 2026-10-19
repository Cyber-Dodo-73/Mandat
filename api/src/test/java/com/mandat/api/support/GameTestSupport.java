package com.mandat.api.support;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;

import com.mandat.api.common.security.AuthenticatedUser;
import com.mandat.api.common.wallet.WalletSource;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

public final class GameTestSupport {

    private GameTestSupport() {}

    public static UUID newUser(JdbcClient jdbc) {
        return TestUsers.create(jdbc);
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

    /** Net wallet movement caused by one source (e.g. only the pack domain), ignoring progression rewards. */
    public static int ledger(JdbcClient jdbc, UUID userId, String currency, WalletSource source) {
        return jdbc.sql("""
                        select coalesce(sum(delta), 0) from wallet_ledger
                        where user_id = :id and currency = :currency and source = :source
                        """)
                .param("id", userId).param("currency", currency).param("source", source.key())
                .query(Integer.class).single();
    }

    /** Influence granted by progression (level-ups, achievements, missions, season pass). */
    public static int progressionInfluence(JdbcClient jdbc, UUID userId) {
        return ledger(jdbc, userId, "influence", WalletSource.LEVEL_REWARD)
                + ledger(jdbc, userId, "influence", WalletSource.PROGRESSION_REWARD);
    }
}
