package com.mandat.api.pack;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** A booster opening and its serialized response, replayed for the same Idempotency-Key. */
@Entity
@Table(name = "pack_openings")
public class PackOpening {

    @Id
    private UUID id;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "pack_id")
    private String packId;

    @Column(name = "idempotency_key")
    private String idempotencyKey;

    private String response;

    @Column(name = "opened_at")
    private Instant openedAt;

    protected PackOpening() {}

    PackOpening(UUID id, UUID userId, String packId, String idempotencyKey, String response, Instant openedAt) {
        this.id = id;
        this.userId = userId;
        this.packId = packId;
        this.idempotencyKey = idempotencyKey;
        this.response = response;
        this.openedAt = openedAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getPackId() {
        return packId;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public String getResponse() {
        return response;
    }

    public Instant getOpenedAt() {
        return openedAt;
    }
}
