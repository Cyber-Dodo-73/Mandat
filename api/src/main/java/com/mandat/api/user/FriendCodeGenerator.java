package com.mandat.api.user;

import java.security.SecureRandom;
import org.springframework.stereotype.Component;

/** 8-character codes without ambiguous characters (no I, O, 0, 1), e.g. {@code K7QF2MZD}. */
@Component
public class FriendCodeGenerator {

    static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    static final int LENGTH = 8;

    private final SecureRandom random = new SecureRandom();

    public String next() {
        StringBuilder code = new StringBuilder(LENGTH);
        for (int i = 0; i < LENGTH; i++) {
            code.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return code.toString();
    }
}
