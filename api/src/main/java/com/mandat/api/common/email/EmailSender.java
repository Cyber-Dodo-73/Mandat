package com.mandat.api.common.email;

/** Sends transactional emails (password reset…). Implementations never log the body. */
public interface EmailSender {

    /** True when emails actually leave the server (SMTP configured). */
    boolean deliversEmails();

    void send(String to, String subject, String textBody);
}
