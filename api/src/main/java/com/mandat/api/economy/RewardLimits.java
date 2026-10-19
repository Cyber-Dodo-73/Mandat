package com.mandat.api.economy;

import com.mandat.api.common.entitlement.Entitlement;
import java.time.Duration;

/**
 * Server-enforced pacing of the reward faucets (2026-10-19, docs/BUSINESS.md "Économie de craft").
 * Beyond a cap the game still plays; it just grants no more Influence nor bonus-booster progress.
 */
public final class RewardLimits {

    /** Quizzes per local day that grant Influence and count towards the perfect-quiz booster. */
    public static final int QUIZ_REWARDS_PER_DAY = 3;

    /** Duel wins per local day that grant Influence; once reached, no duel grants Influence that day. */
    public static final int DUEL_WIN_REWARDS_PER_DAY = 5;

    /**
     * Crafting allowance for free players: one craft earned every 48 hours, up to 3 in stock (a new
     * player starts with 1). Keeps "10 duplicates = 1 card of that rarity" while crafting stays about
     * one card every two days.
     */
    public static final CraftPolicy CRAFT_FREE = new CraftPolicy(Duration.ofHours(48), 3, 1);

    /** Premium perk, prepared ahead of payments: applies once an EntitlementProvider reports PREMIUM. */
    public static final CraftPolicy CRAFT_PREMIUM = new CraftPolicy(Duration.ofHours(36), 4, 1);

    private RewardLimits() {}

    public static CraftPolicy craftPolicy(Entitlement entitlement) {
        return entitlement == Entitlement.PREMIUM ? CRAFT_PREMIUM : CRAFT_FREE;
    }

    /** One craft earned every {@code interval}, at most {@code maxStock} banked, {@code startingStock} for a new player. */
    public record CraftPolicy(Duration interval, int maxStock, int startingStock) {}
}
