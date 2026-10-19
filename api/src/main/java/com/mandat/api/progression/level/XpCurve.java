package com.mandat.api.progression.level;

import com.mandat.api.progression.ProgressionProperties;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

/**
 * Level curve: going from level {@code n} to {@code n + 1} costs {@code base + step * (n - 1)} XP
 * (100, 150, 200… with the defaults). Levels are derived from the lifetime XP total.
 */
@Component
public class XpCurve {

    private final int base;
    private final int step;
    private final int maxLevel;

    @Autowired
    public XpCurve(ProgressionProperties properties) {
        this(properties.curve().base(), properties.curve().step(), properties.curve().maxLevel());
    }

    XpCurve(int base, int step, int maxLevel) {
        if (base <= 0 || step < 0 || maxLevel < 1) {
            throw new IllegalArgumentException("Invalid XP curve");
        }
        this.base = base;
        this.step = step;
        this.maxLevel = maxLevel;
    }

    public int maxLevel() {
        return maxLevel;
    }

    /** XP needed to go from {@code level} to {@code level + 1}. */
    public int xpToAdvance(int level) {
        return base + step * (level - 1);
    }

    /** Lifetime XP at which {@code level} is reached (0 for level 1). */
    public int totalXpForLevel(int level) {
        int n = Math.min(Math.max(level, 1), maxLevel) - 1;
        // Sum of an arithmetic series: n * base + step * n * (n - 1) / 2
        return n * base + step * n * (n - 1) / 2;
    }

    public int levelFor(int totalXp) {
        int level = 1;
        while (level < maxLevel && totalXp >= totalXpForLevel(level + 1)) {
            level++;
        }
        return level;
    }
}
