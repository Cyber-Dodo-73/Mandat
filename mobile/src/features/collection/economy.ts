import type { Rarity } from '@/theme/rarity';
import type { CardFinish } from '@/types/card';

/*
 * Display-only copy of the API's EconomyRules (api/.../collection/EconomyRules.java), used to
 * preview a recycle or a craft before confirming. The server decides the real amounts: the
 * screens always show the values returned by the API once the action is done.
 */

const RECYCLE_VALUE: Record<Rarity, number> = {
  common: 5,
  uncommon: 10,
  rare: 25,
  epic: 60,
  legendary: 150,
  mythic: 400,
};

const FINISH_MULTIPLIER: Record<CardFinish, number> = { standard: 1, holo: 2, full_art: 4, gold: 10 };

const CRAFT_COST: Record<Rarity, number> = {
  common: 40,
  uncommon: 80,
  rare: 200,
  epic: 500,
  legendary: 1200,
  mythic: 3000,
};

export function recyclePreview(rarity: Rarity, finish: CardFinish, quantity: number): number {
  return RECYCLE_VALUE[rarity] * FINISH_MULTIPLIER[finish] * Math.max(0, quantity);
}

export function craftCostPreview(rarity: Rarity): number {
  return CRAFT_COST[rarity];
}
