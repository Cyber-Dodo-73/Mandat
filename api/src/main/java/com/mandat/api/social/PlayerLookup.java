package com.mandat.api.social;

import com.mandat.api.common.error.ApiException;
import com.mandat.api.common.error.ErrorCode;
import com.mandat.api.user.User;
import com.mandat.api.user.UserRepository;
import java.util.Locale;
import org.springframework.stereotype.Component;

/** Resolves the friend codes players share (case-insensitive, surrounding spaces ignored). */
@Component
public class PlayerLookup {

    private final UserRepository users;

    PlayerLookup(UserRepository users) {
        this.users = users;
    }

    /** @throws ApiException {@link ErrorCode#NOT_FOUND} for an unknown code */
    public User byFriendCode(String friendCode) {
        String normalized = friendCode == null ? "" : friendCode.strip().toUpperCase(Locale.ROOT);
        return users.findByFriendCode(normalized)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "No player with this friend code"));
    }
}
