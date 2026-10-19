import type { components } from '@/lib/api';

import type {
  ApiOddsResponse,
  ApiOpenPackResponse,
  ApiPacksResponse,
  FreePackState,
  PackOdds,
  PackOpenResult,
  PacksView,
  PackSummary,
  PityCounters,
} from './types';

type ApiPack = components['schemas']['PackDto'];
type ApiFreePacks = components['schemas']['FreePacksDto'];
type ApiPity = components['schemas']['PityDto'];

export function toPackSummary(pack: ApiPack): PackSummary {
  const continent = pack.continent ?? null;
  return {
    id: pack.id,
    theme: continent ?? 'standard',
    continent,
    unlockLevel: pack.requiredLevel > 1 ? pack.requiredLevel : null,
    unlocked: pack.unlocked,
  };
}

export function toFreePacks(freePacks: ApiFreePacks): FreePackState {
  return { stock: freePacks.available, maxStock: freePacks.max, nextFreePackAt: freePacks.nextAt ?? null };
}

export function toPity(pity: ApiPity): PityCounters {
  return {
    packsSinceEpic: pity.packsSinceEpic,
    packsSinceLegendary: pity.packsSinceLegendary,
    epicIn: pity.epicGuaranteedIn,
    legendaryIn: pity.legendaryGuaranteedIn,
  };
}

export function toPacksView(response: ApiPacksResponse): PacksView {
  return {
    packs: response.packs.map(toPackSummary),
    freePacks: toFreePacks(response.freePacks),
    bonusPacks: response.bonusPacks,
    pity: toPity(response.pity),
  };
}

/** The API serves percentages (65.0); the UI formats fractions (0.65). */
export function toPackOdds(response: ApiOddsResponse): PackOdds {
  return {
    slots: response.slots.map((group) => ({
      slots: group.slots,
      rates: Object.fromEntries(group.rarities.map(({ rarity, percent }) => [rarity, percent / 100])),
    })),
    finishes: response.finishes.map((finish) => ({
      finish: finish.finish,
      rate: finish.percent / 100,
      minRarity: finish.minRarity ?? null,
      guaranteedSlotOnly: finish.guaranteedSlotOnly,
    })),
    pity: { epicEvery: response.pity.epicEveryPacks, legendaryEvery: response.pity.legendaryEveryPacks },
    continentFallback: response.continentFallback,
  };
}

export function toPackOpenResult(response: ApiOpenPackResponse): PackOpenResult {
  return {
    openingId: response.openingId,
    packId: response.packId,
    cards: [...response.cards]
      .sort((a, b) => a.slot - b.slot)
      .map((card) => ({
        cardId: card.cardId,
        rarity: card.rarity,
        finish: card.finish,
        isNew: card.isNew,
        influenceGained: card.influenceGained,
      })),
    influenceGained: response.influenceGained,
    pity: toPity(response.pity),
    freePacks: toFreePacks(response.freePacks),
    bonusPacks: response.bonusPacks,
  };
}
