import type { Language } from '@/i18n';
import type { Card } from '@/types/card';

import type { AppliedEffect, Duel, DuelRound } from './api';

export type Side = 'player' | 'ai';

export type EffectLine = {
  side: Side;
  cardId: string;
  /** Ability name as printed on the card (from the local catalog). */
  abilityName: string;
  type: AppliedEffect['type'];
  stat: AppliedEffect['stat'];
  /** Signed change on the value it affects: bonus +n on its own card, malus -n on the opponent's. */
  delta: number;
  /** Card whose value changes: a malus hits the opposing card. */
  target: Side;
};

export type RoundView = {
  round: number;
  domain: DuelRound['domain'];
  player: { cardId: string; base: number; value: number };
  ai: { cardId: string; base: number; value: number };
  effects: EffectLine[];
  winner: DuelRound['winner'];
  tieRule: DuelRound['tieRule'];
};

type CardLookup = (id: string) => Card | undefined;

/** Turns a server round into what the board shows; nothing is recomputed, only labelled. */
export function roundView(round: DuelRound, lookup: CardLookup, language: Language): RoundView {
  return {
    round: round.round,
    domain: round.domain,
    player: { cardId: round.playerCardId, base: round.playerBase, value: round.playerValue },
    ai: { cardId: round.aiCardId, base: round.aiBase, value: round.aiValue },
    effects: round.effects.map((effect) => effectLine(effect, lookup, language)),
    winner: round.winner,
    tieRule: round.tieRule ?? null,
  };
}

export function effectLine(effect: AppliedEffect, lookup: CardLookup, language: Language): EffectLine {
  const card = lookup(effect.cardId);
  const abilityName = card ? card.ability.name[language] || card.ability.name.fr : effect.cardId;
  const opponent: Side = effect.side === 'player' ? 'ai' : 'player';
  if (effect.type === 'malus') {
    return { side: effect.side, cardId: effect.cardId, abilityName, type: effect.type, stat: effect.stat, delta: -effect.amount, target: opponent };
  }
  return {
    side: effect.side,
    cardId: effect.cardId,
    abilityName,
    type: effect.type,
    stat: effect.stat,
    delta: effect.type === 'bonus' ? effect.amount : 0,
    target: effect.side,
  };
}

/** Last resolved round, or null before the first card is played. */
export function latestRound(duel: Duel): DuelRound | null {
  if (duel.rounds.length === 0) return null;
  return [...duel.rounds].sort((a, b) => a.round - b.round)[duel.rounds.length - 1] ?? null;
}

/** Cards each side still holds, in team order. */
export function handsLeft(duel: Duel): { player: string[]; ai: string[] } {
  const player = new Set(duel.playerCardsLeft);
  const ai = new Set(duel.aiCardsLeft);
  return {
    player: duel.playerCards.filter((id) => player.has(id)),
    ai: duel.aiCards.filter((id) => ai.has(id)),
  };
}

/** A stored duel is worth resuming only while the server still reports it active. */
export function isDuelResumable(duel: Duel | undefined): boolean {
  return Boolean(duel && duel.status === 'active' && duel.nextDomain);
}
