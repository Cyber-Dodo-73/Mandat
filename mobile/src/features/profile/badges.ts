import { GOLD } from '@/components/cards';
import { rarityStyles } from '@/theme/rarity';

import { badgeFamily, type BadgeFamily } from './cosmetics';
import type { Achievement } from './queries';

export type BadgeMetal = 'bronze' | 'silver' | 'gold';

export const METAL_COLORS: Record<BadgeMetal, string> = {
  bronze: '#C08457',
  silver: rarityStyles.common.color,
  gold: GOLD.base,
};

export type BadgeItem = {
  id: string;
  family: BadgeFamily | null;
  metal: BadgeMetal;
  unlocked: boolean;
  /** 0–1 progress toward unlocking. */
  progress: number;
  threshold: number;
  param: string | null;
};

/**
 * One medal per achievement. Within a family (same metric), thresholds are ranked: the first
 * tier is bronze, the second silver, the rest gold. Unlocked badges come first.
 */
export function toBadges(achievements: readonly Achievement[]): BadgeItem[] {
  const ranks = new Map<string, number>();
  const groups = new Map<string, Achievement[]>();
  for (const achievement of achievements) {
    const group = `${achievement.metric}:${achievement.param ?? ''}`;
    groups.set(group, [...(groups.get(group) ?? []), achievement]);
  }
  for (const group of groups.values()) {
    [...group].sort((a, b) => a.threshold - b.threshold).forEach((achievement, index) => ranks.set(achievement.id, index));
  }
  const metal = (rank: number): BadgeMetal => (rank <= 0 ? 'bronze' : rank === 1 ? 'silver' : 'gold');
  return achievements
    .map((achievement) => ({
      id: achievement.id,
      family: badgeFamily(achievement.id),
      metal: metal(ranks.get(achievement.id) ?? 0),
      unlocked: Boolean(achievement.unlockedAt),
      progress: achievement.threshold > 0 ? Math.min(1, achievement.progress / achievement.threshold) : 0,
      threshold: achievement.threshold,
      param: achievement.param ?? null,
    }))
    .sort((a, b) => Number(b.unlocked) - Number(a.unlocked));
}
