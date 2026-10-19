package com.mandat.api.collection;

import com.mandat.api.card.CardFinish;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.Immutable;

/** Owned (card, finish) pair. Read through JPA, written by {@link CollectionService} with atomic SQL. */
@Entity
@Immutable
@Table(name = "collection_items")
public class CollectionItem {

    @EmbeddedId
    private Key key;

    private int quantity;

    @Column(name = "first_obtained_at")
    private Instant firstObtainedAt;

    @Column(name = "last_obtained_at")
    private Instant lastObtainedAt;

    protected CollectionItem() {}

    public Key getKey() {
        return key;
    }

    public int getQuantity() {
        return quantity;
    }

    public Instant getFirstObtainedAt() {
        return firstObtainedAt;
    }

    public Instant getLastObtainedAt() {
        return lastObtainedAt;
    }

    @Embeddable
    public record Key(
            @Column(name = "user_id") UUID userId,
            @Column(name = "card_id") String cardId,
            @Column(name = "finish") CardFinish finish) implements Serializable {

        private static final long serialVersionUID = 1L;
    }
}
