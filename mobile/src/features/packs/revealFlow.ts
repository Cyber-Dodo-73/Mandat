import { rarityRank } from '@/theme/rarity';

import type { DrawnCard } from './types';

/**
 * Display order of a pack: ascending rarity so the best card always comes last (ties keep
 * their slot order). Only the presentation changes — the server result is untouched.
 */
export function revealOrder(cards: readonly DrawnCard[]): DrawnCard[] {
  return cards
    .map((card, slot) => ({ card, slot }))
    .sort((a, b) => rarityRank(a.card.rarity) - rarityRank(b.card.rarity) || a.slot - b.slot)
    .map(({ card }) => card);
}

/** Top card of the stack: face down, playing its reveal, or face up waiting to be sent away. */
export type TopCardState = 'hidden' | 'revealing' | 'revealed';

export type RevealFlowState = {
  /** Index of the top card in the reveal order; equals the card count once all are seen. */
  index: number;
  top: TopCardState;
  phase: 'stack' | 'summary';
};

export type RevealFlowEvent =
  /** Tap on the top card (or VoiceOver activate). */
  | { type: 'tap'; skippable: boolean }
  /** Horizontal swipe on the top card. */
  | { type: 'swipe'; skippable: boolean }
  /** The reveal sequence of the top card ended (or was skipped). */
  | { type: 'revealed' };

export type RevealFlowEffect = 'none' | 'startReveal' | 'skipReveal' | 'dismiss';

export function initialRevealFlow(count: number): RevealFlowState {
  return { index: 0, top: 'hidden', phase: count > 0 ? 'stack' : 'summary' };
}

/**
 * tap → reveal, tap (or swipe) → the card flies off and the next one is on top, after the last
 * one → summary. Every step is accepted immediately: nothing waits for an animation to end.
 */
export function revealFlowStep(
  state: RevealFlowState,
  event: RevealFlowEvent,
  count: number,
): { state: RevealFlowState; effect: RevealFlowEffect } {
  if (state.phase === 'summary') return { state, effect: 'none' };

  if (event.type === 'revealed') {
    return state.top === 'revealing' ? { state: { ...state, top: 'revealed' }, effect: 'none' } : { state, effect: 'none' };
  }

  switch (state.top) {
    case 'hidden':
      return { state: { ...state, top: 'revealing' }, effect: 'startReveal' };
    case 'revealing':
      return event.skippable ? { state: { ...state, top: 'revealed' }, effect: 'skipReveal' } : { state, effect: 'none' };
    case 'revealed': {
      const index = state.index + 1;
      return {
        state: { index, top: 'hidden', phase: index >= count ? 'summary' : 'stack' },
        effect: 'dismiss',
      };
    }
  }
}
