import { RARITIES, type Rarity } from '@/theme/rarity';
import type { Card } from '@/types/card';

import { historyChunkOf, type CardHistory } from './catalogSplit';
import raw from './cards.season1.json';
import { HISTORY_CHUNK_SIZE, loadHistoryChunk } from './history/chunks.generated';

export type { CardHistory, TimelineEntry } from './catalogSplit';

type CatalogFile = { season: number; version?: string | number; cards: Card[] };

/**
 * Light index of the season, parsed at startup: everything a card face, a list or a reveal
 * needs. The long-form history lives in separate chunks (see getCardHistory).
 */
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

const loadedChunks = new Map<number, Record<string, CardHistory>>();

/**
 * Story, highlights, legacy and timeline of a card. Synchronous: the first call for a card
 * evaluates its chunk (about 50 cards of long-form text), later calls hit the cache.
 */
export function getCardHistory(id: string): CardHistory | undefined {
  const card = byId.get(id);
  if (!card) return undefined;
  const chunkIndex = historyChunkOf(card.number, HISTORY_CHUNK_SIZE);
  let chunk = loadedChunks.get(chunkIndex);
  if (!chunk) {
    chunk = loadHistoryChunk(chunkIndex) ?? {};
    loadedChunks.set(chunkIndex, chunk);
  }
  return chunk[id];
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
