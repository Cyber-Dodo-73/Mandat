import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';

import { trackFtue } from './analytics';
import { currentStep, ftueReducer, initialFtueState, shouldCelebrateEpic, type FtueAction, type FtueState } from './machine';
import type { FtueEventName } from './steps';

type FtueStore = {
  state: FtueState;
  /** Transient (not persisted): "Ta première Épique !" banner on screen. */
  epicBanner: boolean;
  dispatch: (action: FtueAction, reason?: 'player' | 'offline' | 'unavailable') => void;
  showEpicBanner: () => void;
  hideEpicBanner: () => void;
};

/**
 * Tour progress, persisted so a killed app resumes on the same step. Kept on the device only:
 * it is a UX helper, not game value.
 */
export const useFtueStore = create<FtueStore>()(
  persist(
    (set, get) => ({
      state: initialFtueState,
      epicBanner: false,
      dispatch: (action, reason = 'player') => {
        const before = get().state;
        const after = ftueReducer(before, action);
        if (after === before) return;
        set({ state: after });
        trackTransition(before, after, action, reason);
      },
      showEpicBanner: () => set({ epicBanner: true }),
      hideEpicBanner: () => set({ epicBanner: false }),
    }),
    {
      name: 'ftue',
      version: 1,
      storage: createJSONStorage(() => zustandStorage),
      partialize: ({ state }) => ({ state }),
    },
  ),
);

function trackTransition(before: FtueState, after: FtueState, action: FtueAction, reason: 'player' | 'offline' | 'unavailable') {
  const leaving = currentStep(before);
  if (action.type === 'start') trackFtue({ name: 'ftue_started' });
  if (leaving && leaving.id !== currentStep(after)?.id) {
    if (action.type === 'skipAll') trackFtue({ name: 'ftue_skipped_all', step: leaving.id });
    else if (action.type === 'skipStep') trackFtue({ name: 'ftue_step_skipped', step: leaving.id, reason });
    else trackFtue({ name: 'ftue_step_completed', step: leaving.id });
  }
  if (before.status === 'active' && after.status === 'done' && action.type !== 'skipAll') {
    trackFtue({ name: 'ftue_completed' });
  }
}

/** Screens report what happened (pack opened, torn, revealed…); the tour advances on its own. */
export function ftueEvent(name: FtueEventName): void {
  useFtueStore.getState().dispatch({ type: 'event', name });
}

/** Called for every revealed card of a pack; celebrates the tour's first epic or better. */
export function ftueCardRevealed(rarityRank: number): void {
  const store = useFtueStore.getState();
  if (!shouldCelebrateEpic(store.state, rarityRank)) return;
  store.dispatch({ type: 'epicCelebrated' });
  store.showEpicBanner();
  trackFtue({ name: 'ftue_epic_celebrated' });
}
