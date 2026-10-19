import type { AchievementsView } from '@/features/progression/api';

export const PERFECT_QUIZZES_PER_BONUS = 5;

export type PlayStats = {
  /** Perfect quizzes counted towards the next bonus booster (0–4), null when unknown. */
  perfectTowardsBonus: number | null;
  duelWins: number;
  /** True when the counter reached the highest achievement threshold (shown as "N+"). */
  duelWinsCapped: boolean;
};

/**
 * Hub counters read from achievement progress (the server's own counters). Progress is capped
 * at each achievement's threshold, so the highest threshold bounds what can be shown.
 */
export function playStats(view: AchievementsView | undefined): PlayStats {
  const achievements = view?.achievements ?? [];
  const best = (metric: string) =>
    achievements
      .filter((achievement) => achievement.metric === metric)
      .reduce(
        (acc, achievement) => ({
          progress: Math.max(acc.progress, achievement.progress),
          cap: Math.max(acc.cap, achievement.threshold),
        }),
        { progress: 0, cap: 0 },
      );
  const perfect = best('PERFECT_QUIZZES');
  const duels = best('DUELS_WON');
  return {
    perfectTowardsBonus: perfect.cap > 0 && perfect.progress < perfect.cap ? perfect.progress % PERFECT_QUIZZES_PER_BONUS : null,
    duelWins: duels.progress,
    duelWinsCapped: duels.cap > 0 && duels.progress >= duels.cap,
  };
}
