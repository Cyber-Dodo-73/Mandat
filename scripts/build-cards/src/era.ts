import type { Era } from './types.ts';

/**
 * Era from birth year (historical years, BCE negative). Thresholds put each person in the
 * era where they were active: born before 450 → antiquity (ends with the fall of the Western
 * Roman Empire, 476), before 1450 → medieval (ends ~1450–1500), before 1860 → modern (people
 * born from 1860 were active in the 20th century) and contemporary after that.
 */
export const ERA_THRESHOLDS = { medieval: 450, modern: 1450, contemporary: 1860 } as const;

export function eraOf(birthYear: number): Era {
  if (birthYear < ERA_THRESHOLDS.medieval) return 'antiquity';
  if (birthYear < ERA_THRESHOLDS.modern) return 'medieval';
  if (birthYear < ERA_THRESHOLDS.contemporary) return 'modern';
  return 'contemporary';
}
