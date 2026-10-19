import type { Card } from '@/types/card';

import type { Duel, DuelRound } from '../api';
import { effectLine, handsLeft, isDuelResumable, latestRound, roundView } from '../viewModel';

const card = (id: string, fr: string, en: string): Card =>
  ({ id, ability: { name: { fr, en }, description: { fr: '', en: '' } } }) as unknown as Card;

const cards = new Map([
  ['s1-001', card('s1-001', 'Réconciliation', 'Reconciliation')],
  ['s1-002', card('s1-002', 'Coup de bluff', 'Bluff')],
]);
const lookup = (id: string) => cards.get(id);

const round: DuelRound = {
  round: 1,
  domain: 'diplomacy',
  playerCardId: 's1-001',
  playerBase: 7,
  playerValue: 9,
  aiCardId: 's1-002',
  aiBase: 8,
  aiValue: 8,
  effects: [
    { side: 'player', cardId: 's1-001', type: 'bonus', stat: 'diplomacy', amount: 2, condition: 'opponentContinent' },
    { side: 'ai', cardId: 's1-002', type: 'malus', stat: 'any', amount: 1, condition: 'always' },
  ],
  winner: 'player',
  tieRule: null,
};

const duel = (overrides: Partial<Duel>): Duel => ({
  id: 'd1',
  createdAt: '2026-10-19T12:00:00.123456Z',
  difficulty: 'normal',
  status: 'active',
  playerCards: ['a', 'b', 'c'],
  playerCardsLeft: ['a', 'c'],
  aiCards: ['x', 'y', 'z'],
  aiCardsLeft: ['z', 'x'],
  playerScore: 1,
  aiScore: 0,
  roundsPlayed: 1,
  nextDomain: 'charisma',
  rounds: [round],
  ...overrides,
});

describe('duel view model', () => {
  it('labels each applied effect with the ability name and keeps server values', () => {
    const view = roundView(round, lookup, 'fr');
    expect(view.player).toEqual({ cardId: 's1-001', base: 7, value: 9 });
    expect(view.ai).toEqual({ cardId: 's1-002', base: 8, value: 8 });
    expect(view.effects[0]).toMatchObject({ abilityName: 'Réconciliation', delta: 2, target: 'player' });
    expect(view.winner).toBe('player');
  });

  it('shows a malus as a negative change on the opposing card', () => {
    expect(effectLine(round.effects[1]!, lookup, 'en')).toMatchObject({ abilityName: 'Bluff', delta: -1, target: 'player', side: 'ai' });
  });

  it('shows a tie breaker without a value change and falls back to the card id', () => {
    const line = effectLine({ side: 'ai', cardId: 's1-404', type: 'tieBreaker', stat: 'any', amount: 0, condition: 'behind' }, lookup, 'fr');
    expect(line).toMatchObject({ abilityName: 's1-404', delta: 0, target: 'ai' });
  });

  it('keeps hands in team order and finds the latest round', () => {
    const d = duel({ rounds: [{ ...round, round: 2 }, round] });
    expect(handsLeft(d)).toEqual({ player: ['a', 'c'], ai: ['x', 'z'] });
    expect(latestRound(d)?.round).toBe(2);
    expect(latestRound(duel({ rounds: [] }))).toBeNull();
  });

  it('resumes only active duels with an announced domain', () => {
    expect(isDuelResumable(duel({}))).toBe(true);
    expect(isDuelResumable(duel({ status: 'finished', nextDomain: null }))).toBe(false);
    expect(isDuelResumable(duel({ status: 'abandoned' }))).toBe(false);
    expect(isDuelResumable(undefined)).toBe(false);
  });
});
