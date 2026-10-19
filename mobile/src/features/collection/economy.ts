import { useQuery } from '@tanstack/react-query';

import { api, unwrap, type components } from '@/lib/api';
import type { Rarity } from '@/theme/rarity';
import type { CardFinish } from '@/types/card';

/*
 * Craft and recycle rules come from the server (GET /api/v1/economy), the single source of truth.
 * They are cached and persisted with the rest of React Query, so previews keep working offline.
 * FALLBACK_RULES only covers a first launch without network: it mirrors EconomyRules.java
 * (2026-10-19). The screens always show the amounts returned by the API once an action is done.
 */

export type EconomyRules = components['schemas']['EconomyResponse'];
export type PlayerLimits = components['schemas']['LimitsResponse'];

export const economyQueryKey = ['economy'] as const;
export const limitsQueryKey = ['limits'] as const;

const HOUR = 3_600_000;

export const FALLBACK_RULES: EconomyRules = {
  rarities: [
    { rarity: 'common', craftCost: 100, holoUpgradeCost: 200, recycleValue: 10, duplicateBonus: 2 },
    { rarity: 'uncommon', craftCost: 200, holoUpgradeCost: 400, recycleValue: 20, duplicateBonus: 4 },
    { rarity: 'rare', craftCost: 500, holoUpgradeCost: 1000, recycleValue: 50, duplicateBonus: 10 },
    { rarity: 'epic', craftCost: 1200, holoUpgradeCost: 2400, recycleValue: 120, duplicateBonus: 25 },
    { rarity: 'legendary', craftCost: 3000, holoUpgradeCost: 6000, recycleValue: 300, duplicateBonus: 60 },
    { rarity: 'mythic', craftCost: 8000, holoUpgradeCost: 16000, recycleValue: 800, duplicateBonus: 150 },
  ],
  finishes: [
    { finish: 'standard', multiplier: 1 },
    { finish: 'holo', multiplier: 2 },
    { finish: 'full_art', multiplier: 4 },
    { finish: 'gold', multiplier: 5 },
  ],
  craftFinish: 'standard',
  keptCopiesWhenRecycling: 1,
};

/** Server economy rules, falling back to the last known (or bundled) values offline. */
export function useEconomyRules(): EconomyRules {
  const query = useQuery<EconomyRules>({
    queryKey: economyQueryKey,
    queryFn: () => unwrap(api.GET('/api/v1/economy')),
    staleTime: HOUR,
  });
  return query.data ?? FALLBACK_RULES;
}

/** Rewards left today and the crafting allowance (1 craft every 48 h, stock 3). */
export function useLimitsQuery() {
  return useQuery<PlayerLimits>({
    queryKey: limitsQueryKey,
    queryFn: () => unwrap(api.GET('/api/v1/limits')),
  });
}

function rarityValues(rules: EconomyRules, rarity: Rarity) {
  return rules.rarities.find((entry) => entry.rarity === rarity) ?? FALLBACK_RULES.rarities.find((entry) => entry.rarity === rarity);
}

function finishMultiplier(rules: EconomyRules, finish: CardFinish): number {
  return rules.finishes.find((entry) => entry.finish === finish)?.multiplier ?? 1;
}

export function recyclePreview(rules: EconomyRules, rarity: Rarity, finish: CardFinish, quantity: number): number {
  return (rarityValues(rules, rarity)?.recycleValue ?? 0) * finishMultiplier(rules, finish) * Math.max(0, quantity);
}

export function craftCostPreview(rules: EconomyRules, rarity: Rarity): number {
  return rarityValues(rules, rarity)?.craftCost ?? 0;
}

/** Influence to turn one standard copy into a holo copy (server rule: twice the craft cost). */
export function holoUpgradeCostPreview(rules: EconomyRules, rarity: Rarity): number {
  return rarityValues(rules, rarity)?.holoUpgradeCost ?? 0;
}
