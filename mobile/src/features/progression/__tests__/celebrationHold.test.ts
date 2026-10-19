import { useCelebrations } from '../celebrations';

describe('celebration holds', () => {
  beforeEach(() => useCelebrations.setState({ queue: [], holds: 0, topLevel: 0 }));

  it('keeps level-ups queued while a pack opening holds them', () => {
    const store = useCelebrations.getState();
    store.hold();
    store.push({ type: 'levelUp', level: 3, rewards: null });
    expect(useCelebrations.getState()).toMatchObject({ holds: 1, queue: [{ type: 'levelUp', level: 3 }] });
    store.release();
    expect(useCelebrations.getState()).toMatchObject({ holds: 0, queue: [{ type: 'levelUp', level: 3 }] });
  });

  it('never goes below zero holds', () => {
    useCelebrations.getState().release();
    expect(useCelebrations.getState().holds).toBe(0);
  });
});
