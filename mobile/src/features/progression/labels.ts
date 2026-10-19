import type { Achievement, Mission, Reward } from './api';

/**
 * Untyped translate: these keys are built from server values (mission types, metrics,
 * params), so they can't be checked against the typed key list. Unknown keys fall back.
 */
export type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Casts the typed `t` of useTranslation for server-driven keys. */
export const loose = (t: unknown) => t as Translate;

/** Localized name of a server param (continent, era, rarity or finish key). */
function paramLabel(t: Translate, param: string | null | undefined): string {
  if (!param) return '';
  const candidates = [`packs.names.${param}`, `achievements.eras.${param}`, `rarity.${param}`, `cards.finish.${param}`];
  for (const key of candidates) {
    if (t(key, { defaultValue: '' }) !== '') return t(key);
  }
  return param;
}

/** "Ouvre 2 boosters", built from the mission type and target (templates share wordings). */
export function missionLabel(t: Translate, mission: Mission): string {
  return t(`missions.types.${mission.type}`, {
    count: mission.target,
    param: paramLabel(t, mission.param),
    defaultValue: mission.templateId,
  });
}

export function achievementLabel(t: Translate, achievement: Achievement): string {
  return t(`achievements.metrics.${achievement.metric}`, {
    count: achievement.threshold,
    param: paramLabel(t, achievement.param),
    defaultValue: achievement.id,
  });
}

export function achievementCategoryLabel(t: Translate, category: string): string {
  return t(`achievements.categories.${category}`, { defaultValue: category });
}

/** Reward parts in display order, e.g. ["+50 XP", "+20 Influence", "+1 booster"]. */
export function rewardParts(t: Translate, reward: Reward): string[] {
  const parts: string[] = [];
  if (reward.xp > 0) parts.push(t('progression.reward.xp', { count: reward.xp }));
  if (reward.influence > 0) parts.push(t('progression.reward.influence', { count: reward.influence }));
  if (reward.bonusPacks > 0) parts.push(t('progression.reward.packs', { count: reward.bonusPacks }));
  for (const unlock of reward.unlocks) {
    parts.push(t(`progression.reward.unlock.${unlock.kind}`, { defaultValue: unlock.itemId }));
  }
  return parts;
}
