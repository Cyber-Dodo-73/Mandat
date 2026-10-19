package com.mandat.api.progression;

import java.util.ArrayList;
import java.util.List;

/** A bundle granted by levels, missions, achievements and the season pass. */
public record Reward(int xp, int influence, int bonusPacks, List<Unlock> unlocks) {

    public static final Reward NONE = new Reward(0, 0, 0, List.of());

    public Reward {
        unlocks = List.copyOf(unlocks);
    }

    public static Reward xp(int xp) {
        return new Reward(xp, 0, 0, List.of());
    }

    public static Reward influence(int influence) {
        return new Reward(0, influence, 0, List.of());
    }

    public static Reward packs(int bonusPacks) {
        return new Reward(0, 0, bonusPacks, List.of());
    }

    public static Reward unlock(Unlock.Kind kind, String itemId) {
        return new Reward(0, 0, 0, List.of(new Unlock(kind, itemId)));
    }

    public Reward plus(Reward other) {
        List<Unlock> merged = new ArrayList<>(unlocks);
        merged.addAll(other.unlocks);
        return new Reward(xp + other.xp, influence + other.influence, bonusPacks + other.bonusPacks, merged);
    }

    /** A cosmetic item. Ids are stable keys the client maps to assets and i18n. */
    public record Unlock(Kind kind, String itemId) {

        public enum Kind {
            avatar, banner, title
        }
    }
}
