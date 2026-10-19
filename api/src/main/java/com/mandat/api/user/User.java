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

    public static final String ROLE_PLAYER = "player";
    public static final String ROLE_ADMIN = "admin";

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

    /** True once a provider vouched for the email or its owner proved control of the mailbox. */
    @Column(name = "email_verified", nullable = false)
    private boolean emailVerified;

    /** Version of the terms of service accepted, {@code null} when never accepted (older accounts). */
    @Column(name = "terms_version")
    private String termsVersion;

    @Column(name = "terms_accepted_at")
    private Instant termsAcceptedAt;

    /** When the player confirmed meeting the minimum age. */
    @Column(name = "age_confirmed_at")
    private Instant ageConfirmedAt;

    @Column(nullable = false)
    private String role = ROLE_PLAYER;

    @Column(name = "banned_at")
    private Instant bannedAt;

    @Column(name = "ban_reason")
    private String banReason;

    /** Encrypted Apple refresh token, kept only to revoke the Sign in with Apple authorization. */
    @Column(name = "apple_refresh_token")
    private String appleRefreshToken;

    /** Last nickname change, {@code null} when never changed since sign-up. */
    @Column(name = "nickname_changed_at")
    private Instant nicknameChangedAt;

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

    public Instant getNicknameChangedAt() {
        return nicknameChangedAt;
    }

    void changeNickname(String nickname, Instant now) {
        this.nickname = nickname;
        this.nicknameChangedAt = now;
        this.updatedAt = now;
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

    public boolean isEmailVerified() {
        return emailVerified;
    }

    void setEmailVerified(boolean emailVerified) {
        this.emailVerified = emailVerified;
    }

    public String getTermsVersion() {
        return termsVersion;
    }

    public Instant getTermsAcceptedAt() {
        return termsAcceptedAt;
    }

    public Instant getAgeConfirmedAt() {
        return ageConfirmedAt;
    }

    void acceptTerms(String version, Instant now) {
        this.termsVersion = version;
        this.termsAcceptedAt = now;
        this.ageConfirmedAt = now;
        this.updatedAt = now;
    }

    public String getRole() {
        return role;
    }

    public boolean isAdmin() {
        return ROLE_ADMIN.equals(role);
    }

    public Instant getBannedAt() {
        return bannedAt;
    }

    public boolean isBanned() {
        return bannedAt != null;
    }

    public String getBanReason() {
        return banReason;
    }

    void ban(String reason, Instant now) {
        this.bannedAt = now;
        this.banReason = reason;
        this.updatedAt = now;
    }

    void unban(Instant now) {
        this.bannedAt = null;
        this.banReason = null;
        this.updatedAt = now;
    }

    public String getAppleRefreshToken() {
        return appleRefreshToken;
    }

    void setAppleRefreshToken(String appleRefreshToken) {
        this.appleRefreshToken = appleRefreshToken;
    }

    void forceNickname(String nickname, Instant now) {
        this.nickname = nickname;
        this.updatedAt = now;
    }

    void touch(Instant now) {
        this.updatedAt = now;
    }
}
