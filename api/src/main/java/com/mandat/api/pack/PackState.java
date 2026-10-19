package com.mandat.api.pack;

import com.mandat.api.pack.draw.PityCounters;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Per-player booster state: free booster timer anchor, opened count and pity counters. */
@Entity
@Table(name = "pack_states")
public class PackState {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "free_packs_anchor")
    private Instant freePacksAnchor;

    @Column(name = "packs_opened")
    private int packsOpened;

    @Column(name = "packs_since_epic")
    private int packsSinceEpic;

    @Column(name = "packs_since_legendary")
    private int packsSinceLegendary;

    protected PackState() {}

    public UUID getUserId() {
        return userId;
    }

    public Instant getFreePacksAnchor() {
        return freePacksAnchor;
    }

    public int getPacksOpened() {
        return packsOpened;
    }

    public PityCounters pity() {
        return new PityCounters(packsSinceEpic, packsSinceLegendary);
    }

    void consumeFreePack(Instant newAnchor) {
        this.freePacksAnchor = newAnchor;
    }

    void recordOpening(PityCounters pityAfter) {
        this.packsOpened++;
        this.packsSinceEpic = pityAfter.packsSinceEpic();
        this.packsSinceLegendary = pityAfter.packsSinceLegendary();
    }
}
