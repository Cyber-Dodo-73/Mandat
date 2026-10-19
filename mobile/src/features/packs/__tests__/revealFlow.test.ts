import { initialRevealFlow, revealFlowStep, revealOrder, type RevealFlowState } from '../revealFlow';
import type { DrawnCard } from '../types';

function drawn(cardId: string, rarity: DrawnCard['rarity']): DrawnCard {
  return { cardId, rarity, finish: 'standard', isNew: false, influenceGained: 0 };
}

describe('revealOrder', () => {
  it('reveals the rarest card last and keeps slot order between equal rarities', () => {
    const cards = [drawn('a', 'rare'), drawn('b', 'common'), drawn('c', 'mythic'), drawn('d', 'common'), drawn('e', 'uncommon')];
    expect(revealOrder(cards).map((card) => card.cardId)).toEqual(['b', 'd', 'e', 'a', 'c']);
  });

  it('does not mutate the server result', () => {
    const cards = [drawn('a', 'epic'), drawn('b', 'common')];
    revealOrder(cards);
    expect(cards.map((card) => card.cardId)).toEqual(['a', 'b']);
  });
});

describe('revealFlowStep', () => {
  const run = (count: number, events: Parameters<typeof revealFlowStep>[1][]) =>
    events.reduce<{ state: RevealFlowState; effects: string[] }>(
      (acc, event) => {
        const { state, effect } = revealFlowStep(acc.state, event, count);
        return { state, effects: [...acc.effects, effect] };
      },
      { state: initialRevealFlow(count), effects: [] },
    );

  it('tap reveals, tap again sends the card away, after the last one comes the summary', () => {
    const { state, effects } = run(2, [
      { type: 'tap', skippable: true },
      { type: 'revealed' },
      { type: 'tap', skippable: true },
      { type: 'tap', skippable: true },
      { type: 'revealed' },
      { type: 'swipe', skippable: true },
    ]);
    expect(effects).toEqual(['startReveal', 'none', 'dismiss', 'startReveal', 'none', 'dismiss']);
    expect(state.phase).toBe('summary');
    expect(state.index).toBe(2);
  });

  it('a tap during a skippable reveal jumps to the face-up card, the next tap moves on at once', () => {
    const { state, effects } = run(3, [
      { type: 'tap', skippable: true },
      { type: 'tap', skippable: true },
      { type: 'tap', skippable: true },
    ]);
    expect(effects).toEqual(['startReveal', 'skipReveal', 'dismiss']);
    expect(state).toEqual({ index: 1, top: 'hidden', phase: 'stack' });
  });

  it('first-time reveals cannot be skipped', () => {
    const { state, effects } = run(1, [
      { type: 'tap', skippable: false },
      { type: 'tap', skippable: false },
    ]);
    expect(effects).toEqual(['startReveal', 'none']);
    expect(state.top).toBe('revealing');
  });

  it('a swipe on a face-down card starts its reveal', () => {
    expect(revealFlowStep(initialRevealFlow(5), { type: 'swipe', skippable: true }, 5).effect).toBe('startReveal');
  });
});
