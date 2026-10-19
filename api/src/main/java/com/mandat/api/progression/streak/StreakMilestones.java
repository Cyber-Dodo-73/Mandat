package com.mandat.api.progression.streak;

import com.mandat.api.progression.Reward;
import com.mandat.api.progression.Reward.Unlock;
import java.util.List;
import java.util.Optional;

/**
 * Streak milestones (individual and friend streaks). Influence stays small on purpose: the economy
 * targets about one craft every two days, so streaks reward with freezes and cosmetics first.
 */
public final class StreakMilestones {

    private StreakMilestones() {}

    /** Reward of an individual milestone; {@code freezes} are added to the inventory (capped). */
    public record Milestone(int days, Reward reward, int freezes) {}

    public static final List<Milestone> PERSONAL = List.of(
            new Milestone(3, Reward.influence(10), 0),
            new Milestone(7, Reward.influence(20), 1),
            new Milestone(14, Reward.influence(30), 1),
            new Milestone(30, Reward.influence(40).plus(Reward.packs(1))
                    .plus(Reward.unlock(Unlock.Kind.title, "title.streak_30")), 1),
            new Milestone(50, Reward.influence(50), 1),
            new Milestone(100, Reward.influence(75).plus(Reward.packs(1))
                    .plus(Reward.unlock(Unlock.Kind.avatar, "avatar.streak_100")), 2),
            new Milestone(365, Reward.influence(150).plus(Reward.packs(3))
                    .plus(Reward.unlock(Unlock.Kind.title, "title.streak_365"))
                    .plus(Reward.unlock(Unlock.Kind.banner, "banner.streak_365")), 2));

    /** Friend streak milestones: both players get the reward. */
    public static final List<Milestone> FRIEND = List.of(
            new Milestone(3, Reward.influence(5), 0),
            new Milestone(7, Reward.influence(10), 0),
            new Milestone(14, Reward.influence(15), 0),
            new Milestone(30, Reward.influence(25).plus(Reward.unlock(Unlock.Kind.title, "title.friend_streak_30")), 0),
            new Milestone(50, Reward.influence(30), 0),
            new Milestone(100, Reward.influence(50).plus(Reward.packs(1)), 0),
            new Milestone(365, Reward.influence(100).plus(Reward.packs(1))
                    .plus(Reward.unlock(Unlock.Kind.banner, "banner.friend_streak_365")), 0));

    public static Optional<Milestone> exactly(List<Milestone> milestones, int days) {
        return milestones.stream().filter(m -> m.days() == days).findFirst();
    }

    /** First milestone strictly above {@code days}, if any. */
    public static Optional<Milestone> next(List<Milestone> milestones, int days) {
        return milestones.stream().filter(m -> m.days() > days).findFirst();
    }
}
