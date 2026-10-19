import { setFtueAnalytics, type FtueAnalyticsEvent } from '../analytics';
import { initialFtueState } from '../machine';
import { ftueCardRevealed, ftueEvent, useFtueStore } from '../store';

describe('ftue store', () => {
  let events: FtueAnalyticsEvent[];

  beforeEach(() => {
    events = [];
    setFtueAnalytics({ track: (event) => events.push(event) });
    useFtueStore.setState({ state: initialFtueState, epicBanner: false });
  });

  it('tracks the funnel: start, completed, skipped, quit', () => {
    const { dispatch } = useFtueStore.getState();
    dispatch({ type: 'start' });
    dispatch({ type: 'next' });
    dispatch({ type: 'skipStep' }, 'offline');
    dispatch({ type: 'skipAll' });
    expect(events).toEqual([
      { name: 'ftue_started' },
      { name: 'ftue_step_completed', step: 'welcome' },
      { name: 'ftue_step_skipped', step: 'openFirstPack', reason: 'offline' },
      { name: 'ftue_skipped_all', step: 'tearPack' },
    ]);
    expect(useFtueStore.getState().state.status).toBe('done');
  });

  it('advances on app events and shows the first-epic banner once', () => {
    const { dispatch } = useFtueStore.getState();
    dispatch({ type: 'start' });
    dispatch({ type: 'next' });
    ftueEvent('packScreenOpened');
    ftueEvent('packTorn');
    expect(useFtueStore.getState().state.stepIndex).toBe(3);

    ftueCardRevealed(1);
    expect(useFtueStore.getState().epicBanner).toBe(false);
    ftueCardRevealed(4);
    expect(useFtueStore.getState().epicBanner).toBe(true);
    useFtueStore.getState().hideEpicBanner();
    ftueCardRevealed(5);
    expect(useFtueStore.getState().epicBanner).toBe(false);
    expect(events.filter((event) => event.name === 'ftue_epic_celebrated')).toHaveLength(1);
  });

  it('never lets an analytics failure break the tour', () => {
    setFtueAnalytics({
      track: () => {
        throw new Error('offline logger');
      },
    });
    useFtueStore.getState().dispatch({ type: 'start' });
    expect(useFtueStore.getState().state.status).toBe('active');
  });
});
