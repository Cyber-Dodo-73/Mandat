import type { PackOpenResult, PacksResponse } from './types';

/*
 * TODO(phase 5): delete this file and call the API instead.
 * Dev-only fixtures shaped like `GET /packs` and `POST /packs/{packId}/open`.
 * The server is the only source of truth for draws, timers and pity: nothing here
 * is random or computed, these are fixed sample responses for the UI.
 */

const LATENCY_MS = 700;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Exact rates from the season 1 rules (brief section 7). */
const SEASON_ODDS: PacksResponse['odds'] = {
  slots: [
    { slots: [1, 2, 3, 4], rates: { common: 0.65, uncommon: 0.25, rare: 0.1 } },
    { slots: [5], rates: { rare: 0.7, epic: 0.22, legendary: 0.07, mythic: 0.01 } },
  ],
  pity: { epicEvery: 10, legendaryEvery: 40 },
};

const FIXTURE_PLAYER_LEVEL = 1;

const CONTINENT_UNLOCKS = [
  ['europe', 3],
  ['africa', 4],
  ['asia', 5],
  ['north_america', 6],
  ['south_america', 7],
  ['oceania', 8],
] as const;

export async function fetchPacksMock(): Promise<PacksResponse> {
  await wait(LATENCY_MS / 2);
  return {
    season: 1,
    packs: [
      { id: 's1-standard', theme: 'standard', continent: null, unlockLevel: null, unlocked: true },
      ...CONTINENT_UNLOCKS.map(([continent, level]) => ({
        id: `s1-${continent}`,
        theme: continent,
        continent,
        unlockLevel: level,
        unlocked: FIXTURE_PLAYER_LEVEL >= level,
      })),
    ],
    freePacks: {
      stock: 1,
      maxStock: 2,
      nextFreePackAt: new Date(Date.now() + (5 * 3600 + 12 * 60) * 1000).toISOString(),
    },
    pity: { packsSinceEpic: 3, packsSinceLegendary: 3 },
    odds: SEASON_ODDS,
  };
}

export async function openPackMock(packId: string): Promise<PackOpenResult> {
  await wait(LATENCY_MS);
  return {
    openingId: `dev-${Date.now()}`,
    packId,
    cards: [
      { cardId: 's1-321', rarity: 'common', isNew: true, duplicateInfluence: 0 },
      { cardId: 's1-201', rarity: 'uncommon', isNew: true, duplicateInfluence: 0 },
      { cardId: 's1-322', rarity: 'common', isNew: false, duplicateInfluence: 5 },
      { cardId: 's1-102', rarity: 'rare', isNew: true, duplicateInfluence: 0 },
      { cardId: 's1-042', rarity: 'epic', isNew: true, duplicateInfluence: 0 },
    ],
    influenceGained: 5,
    pity: { packsSinceEpic: 0, packsSinceLegendary: 4 },
    freePacks: { stock: 0, maxStock: 2, nextFreePackAt: new Date(Date.now() + 12 * 3600 * 1000).toISOString() },
  };
}
