import type { CollectionEntry } from '@/features/collection/collectionModel';
import type { Card } from '@/types/card';

import { deckCandidates, statTotal, toggleTeam } from '../deck';

const card = (id: string, number: number, fr: string, total: number): Card =>
  ({
    id,
    number,
    name: { fr, en: fr },
    stats: { influence: total, diplomacy: 0, charisma: 0, strategy: 0 },
  }) as unknown as Card;

const entry = (c: Card, owned = true): CollectionEntry =>
  ({ card: c, owned, bestFinish: 'standard', finishes: ['standard'], copies: owned ? 1 : 0, firstObtainedAt: null }) as CollectionEntry;

describe('duel deck', () => {
  it('toggles cards in and out of a team of 3', () => {
    expect(toggleTeam([], 'a', 3)).toEqual(['a']);
    expect(toggleTeam(['a', 'b'], 'a', 3)).toEqual(['b']);
    expect(toggleTeam(['a', 'b', 'c'], 'd', 3)).toEqual(['a', 'b', 'c']);
  });

  it('lists owned cards only, strongest first, searchable without accents', () => {
    const entries = [entry(card('1', 1, 'Élisabeth', 10)), entry(card('2', 2, 'Napoléon', 20)), entry(card('3', 3, 'Lincoln', 30), false)];
    expect(deckCandidates(entries, '').map((e) => e.card.id)).toEqual(['2', '1']);
    expect(deckCandidates(entries, 'elis').map((e) => e.card.id)).toEqual(['1']);
    expect(statTotal(card('x', 9, 'X', 12))).toBe(12);
  });
});
