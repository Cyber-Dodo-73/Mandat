import { normalizeSearch, type CollectionEntry } from '@/features/collection/collectionModel';
import { STAT_KEYS, type Card } from '@/types/card';

export function statTotal(card: Card): number {
  return STAT_KEYS.reduce((sum, key) => sum + card.stats[key], 0);
}

/** Adds or removes a card from the team; a full team ignores new cards. */
export function toggleTeam(team: readonly string[], cardId: string, size: number): string[] {
  if (team.includes(cardId)) return team.filter((id) => id !== cardId);
  if (team.length >= size) return [...team];
  return [...team, cardId];
}

/** Owned cards matching the search, strongest first (a hint, not a rule: abilities matter too). */
export function deckCandidates(entries: readonly CollectionEntry[], query: string): CollectionEntry[] {
  const needle = normalizeSearch(query);
  return entries
    .filter((entry) => entry.owned)
    .filter((entry) => !needle || [entry.card.name.fr, entry.card.name.en].some((name) => normalizeSearch(name).includes(needle)))
    .sort((a, b) => statTotal(b.card) - statTotal(a.card) || a.card.number - b.card.number);
}
