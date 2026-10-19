package com.mandat.api.common.email;

import java.util.Properties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.stereotype.Component;

/** SMTP sender built from {@link EmailProperties}; logs instead of sending when no host is set. */
@Component
class SmtpEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(SmtpEmailSender.class);

    private final EmailProperties properties;
    private final JavaMailSenderImpl mail;

    SmtpEmailSender(EmailProperties properties) {
        this.properties = properties;
        if (properties.configured()) {
            mail = new JavaMailSenderImpl();
            mail.setHost(properties.host());
            mail.setPort(properties.port());
            mail.setUsername(properties.username());
            mail.setPassword(properties.password());
            Properties extra = mail.getJavaMailProperties();
            extra.put("mail.smtp.auth", String.valueOf(properties.username() != null && !properties.username().isBlank()));
            extra.put("mail.smtp.starttls.enable", "true");
            extra.put("mail.smtp.connectiontimeout", "10000");
            extra.put("mail.smtp.timeout", "10000");
        } else {
            mail = null;
            log.info("SMTP not configured (MANDAT_SMTP_HOST): transactional emails are logged, not sent");
        }
    }

    @Override
    public boolean deliversEmails() {
        return mail != null;
    }

    @Override
    public void send(String to, String subject, String textBody) {
        if (mail == null) {
            log.info("Email not sent (SMTP not configured): subject \"{}\"", subject);
            return;
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(properties.from());
        message.setTo(to);
        message.setSubject(subject);
        message.setText(textBody);
        try {
            mail.send(message);
        } catch (MailException e) {
            log.warn("Email delivery failed: {}", e.getClass().getSimpleName());
        }
    }
}
