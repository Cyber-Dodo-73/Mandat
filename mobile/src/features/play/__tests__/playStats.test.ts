import type { AchievementsView } from '@/features/progression/api';

import { playStats } from '../playStats';

const achievement = (id: string, metric: string, progress: number, threshold: number) => ({
  id,
  category: 'quiz',
  metric,
  progress,
  threshold,
  reward: { bonusPacks: 0, influence: 0, unlocks: [], xp: 0 },
});

const view = (achievements: ReturnType<typeof achievement>[]): AchievementsView => ({
  achievements,
  totalCount: achievements.length,
  unlockedCount: 0,
});

describe('playStats', () => {
  it('counts perfect quizzes towards the next bonus booster', () => {
    const stats = playStats(
      view([achievement('quiz_perfect_1', 'PERFECT_QUIZZES', 1, 1), achievement('quiz_perfect_10', 'PERFECT_QUIZZES', 7, 10)]),
    );
    expect(stats.perfectTowardsBonus).toBe(2);
  });

  it('hides the bonus counter once progress hits the highest threshold', () => {
    expect(playStats(view([achievement('quiz_perfect_10', 'PERFECT_QUIZZES', 10, 10)])).perfectTowardsBonus).toBeNull();
    expect(playStats(undefined).perfectTowardsBonus).toBeNull();
  });

  it('reads duel wins and flags the capped counter', () => {
    const stats = playStats(view([achievement('duel_win_10', 'DUELS_WON', 10, 10), achievement('duel_win_50', 'DUELS_WON', 50, 50)]));
    expect(stats).toMatchObject({ duelWins: 50, duelWinsCapped: true });
    expect(playStats(view([achievement('duel_win_50', 'DUELS_WON', 3, 50)]))).toMatchObject({ duelWins: 3, duelWinsCapped: false });
  });
});
