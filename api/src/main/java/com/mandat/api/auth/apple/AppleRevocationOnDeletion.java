package com.mandat.api.auth.apple;

import com.mandat.api.common.security.SecretCipher;
import com.mandat.api.user.AccountDeletionHook;
import com.mandat.api.user.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Revokes the Sign in with Apple authorization of a deleted account (App Store guideline 5.1.1(v)). */
@Component
class AppleRevocationOnDeletion implements AccountDeletionHook {

    private static final Logger log = LoggerFactory.getLogger(AppleRevocationOnDeletion.class);

    private final AppleAuthorizationClient apple;
    private final SecretCipher cipher;

    AppleRevocationOnDeletion(AppleAuthorizationClient apple, SecretCipher cipher) {
        this.apple = apple;
        this.cipher = cipher;
    }

    @Override
    public void beforeDelete(User user) {
        if (user.getAppleRefreshToken() == null) {
            return;
        }
        if (!apple.enabled()) {
            log.info("Apple revocation skipped: Sign in with Apple signing key not configured");
            return;
        }
        // Stored as "<clientId>\n<refreshToken>", encrypted.
        String stored = cipher.decrypt(user.getAppleRefreshToken());
        int separator = stored == null ? -1 : stored.indexOf('\n');
        if (separator < 0) {
            log.warn("Apple revocation skipped: stored token unreadable");
            return;
        }
        if (!apple.revoke(stored.substring(separator + 1), stored.substring(0, separator))) {
            log.warn("Apple revocation failed for a deleted account");
        }
    }
}
