import { rarityRank, type Rarity } from '@/theme/rarity';
import { CARD_FINISHES, type CardFinish } from '@/types/card';

/** Finishes a card of this rarity can be printed in. */
export function availableFinishes(rarity: Rarity): readonly CardFinish[] {
  return CARD_FINISHES.filter((finish) => finish !== 'full_art' || rarityRank(rarity) >= rarityRank('rare'));
}

export function isFinishAvailable(rarity: Rarity, finish: CardFinish): boolean {
  return availableFinishes(rarity).includes(finish);
}

/** Legendary and mythic cards get the premium treatment in every finish. */
export function isPremium(rarity: Rarity): boolean {
  return rarity === 'legendary' || rarity === 'mythic';
}

/** Metallic gold used by the secret `gold` finish (frame, seal, particles). */
export const GOLD = {
  gradient: ['#FFF3B0', '#E9B93A', '#9C6A10', '#F7D774', '#B8860B'] as const,
  base: '#E9B93A',
  edge: '#7A5208',
  glint: '#FFF8DC',
};
