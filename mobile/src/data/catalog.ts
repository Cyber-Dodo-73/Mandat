import { RARITIES, type Rarity } from '@/theme/rarity';
import type { Card } from '@/types/card';

import raw from './cards.season1.json';

type CatalogFile = { season: number; version?: string | number; cards: Card[] };

const catalog = raw as unknown as CatalogFile;

/** Every card of the season, sorted by collector number. */
export const allCards: readonly Card[] = [...catalog.cards].sort((a, b) => a.number - b.number);

export const seasonNumber: number = catalog.season;

/** Number of cards in the season, shown as the denominator of "042/500". */
export const seasonSize: number = allCards.length;

const byId = new Map(allCards.map((card) => [card.id, card]));

export function getCard(id: string): Card | undefined {
  return byId.get(id);
}

export function cardsByRarity(rarity: Rarity): readonly Card[] {
  return allCards.filter((card) => card.rarity === rarity);
}

/** One card per rarity (highest fame first), plus the most famous sensitive card. */
export function sampleCards(): { rarity: Rarity; card: Card }[] {
  const samples: { rarity: Rarity; card: Card }[] = [];
  for (const rarity of RARITIES) {
    const card = cardsByRarity(rarity).find((candidate) => !candidate.sensitive);
    if (card) samples.push({ rarity, card });
  }
  return samples;
}

export function firstSensitiveCard(): Card | undefined {
  return allCards.find((card) => card.sensitive);
}
