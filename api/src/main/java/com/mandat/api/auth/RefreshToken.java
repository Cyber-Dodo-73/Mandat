package com.mandat.api.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "refresh_tokens")
class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "family_id", nullable = false, updatable = false)
    private UUID familyId;

    @Column(name = "token_hash", nullable = false, updatable = false)
    private byte[] tokenHash;

    @Column(name = "device_label", updatable = false)
    private String deviceLabel;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    protected RefreshToken() {}

    RefreshToken(UUID userId, UUID familyId, byte[] tokenHash, String deviceLabel, Instant createdAt,
            Instant expiresAt) {
        this.userId = userId;
        this.familyId = familyId;
        this.tokenHash = tokenHash;
        this.deviceLabel = deviceLabel;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
    }

    UUID getUserId() {
        return userId;
    }

    UUID getFamilyId() {
        return familyId;
    }

    String getDeviceLabel() {
        return deviceLabel;
    }

    Instant getExpiresAt() {
        return expiresAt;
    }

    boolean isRevoked() {
        return revokedAt != null;
    }

    void revoke(Instant now) {
        this.revokedAt = now;
    }
}
