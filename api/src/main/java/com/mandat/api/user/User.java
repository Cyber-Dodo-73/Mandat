package com.mandat.api.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.DynamicUpdate;

/**
 * Player account. The wallet columns of {@code users} (influence, bonus_packs) are deliberately
 * not mapped: they are only changed through {@code WalletService}, and {@link DynamicUpdate}
 * keeps Hibernate from rewriting columns it did not change.
 */
@Entity
@Table(name = "users")
@DynamicUpdate
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(columnDefinition = "citext")
    private String email;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(columnDefinition = "citext", nullable = false)
    private String nickname;

    @Column(name = "friend_code", nullable = false)
    private String friendCode;

    @Column(name = "apple_sub")
    private String appleSub;

    @Column(name = "google_sub")
    private String googleSub;

    @Column(nullable = false)
    private String locale;

    @Column(nullable = false)
    private String timezone;

    @Column(name = "sound_enabled", nullable = false)
    private boolean soundEnabled = true;

    @Column(name = "haptics_enabled", nullable = false)
    private boolean hapticsEnabled = true;

    @Column(name = "notifications_enabled", nullable = false)
    private boolean notificationsEnabled = true;

    /** {@code null} follows the device setting. */
    @Column(name = "reduce_motion")
    private Boolean reduceMotion;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected User() {}

    User(String nickname, String friendCode, String locale, String timezone, Instant now) {
        this.nickname = nickname;
        this.friendCode = friendCode;
        this.locale = locale;
        this.timezone = timezone;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    void setEmail(String email) {
        this.email = email;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getNickname() {
        return nickname;
    }

    public String getFriendCode() {
        return friendCode;
    }

    public String getAppleSub() {
        return appleSub;
    }

    void setAppleSub(String appleSub) {
        this.appleSub = appleSub;
    }

    public String getGoogleSub() {
        return googleSub;
    }

    void setGoogleSub(String googleSub) {
        this.googleSub = googleSub;
    }

    public String getLocale() {
        return locale;
    }

    void setLocale(String locale) {
        this.locale = locale;
    }

    public String getTimezone() {
        return timezone;
    }

    void setTimezone(String timezone) {
        this.timezone = timezone;
    }

    public boolean isSoundEnabled() {
        return soundEnabled;
    }

    void setSoundEnabled(boolean soundEnabled) {
        this.soundEnabled = soundEnabled;
    }

    public boolean isHapticsEnabled() {
        return hapticsEnabled;
    }

    void setHapticsEnabled(boolean hapticsEnabled) {
        this.hapticsEnabled = hapticsEnabled;
    }

    public boolean isNotificationsEnabled() {
        return notificationsEnabled;
    }

    void setNotificationsEnabled(boolean notificationsEnabled) {
        this.notificationsEnabled = notificationsEnabled;
    }

    public Boolean getReduceMotion() {
        return reduceMotion;
    }

    void setReduceMotion(Boolean reduceMotion) {
        this.reduceMotion = reduceMotion;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    void touch(Instant now) {
        this.updatedAt = now;
    }
}
