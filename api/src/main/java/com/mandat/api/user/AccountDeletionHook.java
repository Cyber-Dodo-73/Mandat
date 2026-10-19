package com.mandat.api.user;

/**
 * Runs before an account is deleted, while its row still exists, so other domains can release
 * what lives outside the database (e.g. revoking a Sign in with Apple authorization). A failure is
 * logged and the deletion goes on.
 */
public interface AccountDeletionHook {

    void beforeDelete(User user);
}
