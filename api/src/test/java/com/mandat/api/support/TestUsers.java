package com.mandat.api.support;

import java.security.SecureRandom;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;

/** Inserts players satisfying every users constraint (nickname, friend code, login method). */
public final class TestUsers {

    private static final String FRIEND_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private TestUsers() {}

    public static UUID create(JdbcClient jdbc) {
        return create(jdbc, UUID.randomUUID(), "UTC");
    }

    public static UUID create(JdbcClient jdbc, UUID id, String timezone) {
        jdbc.sql("""
                insert into users (id, timezone, nickname, friend_code, password_hash)
                values (:id, :tz, :nickname, :friendCode, 'test-hash')
                """)
                .param("id", id)
                .param("tz", timezone)
                .param("nickname", "p" + id.toString().replace("-", "").substring(0, 15))
                .param("friendCode", friendCode())
                .update();
        return id;
    }

    private static String friendCode() {
        StringBuilder code = new StringBuilder(8);
        for (int i = 0; i < 8; i++) {
            code.append(FRIEND_CODE_ALPHABET.charAt(RANDOM.nextInt(FRIEND_CODE_ALPHABET.length())));
        }
        return code.toString();
    }
}
