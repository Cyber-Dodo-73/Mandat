import { create } from 'zustand';

import type { Reward } from './api';

export type Celebration =
  | { id: number; type: 'levelUp'; level: number; rewards: Reward | null }
  | { id: number; type: 'reward'; reward: Reward };

type CelebrationState = {
  queue: Celebration[];
  /**
   * Screens that must not be covered (pack opening): while > 0 celebrations stay queued and
   * show up once the last hold is released.
   */
  holds: number;
  hold: () => void;
  release: () => void;
  /** Highest level already celebrated: a level-up seen twice (claim + level watcher) shows once. */
  topLevel: number;
  push: (celebration: DistributiveOmit<Celebration, 'id'>) => void;
  dismiss: (id: number) => void;
};

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

let nextId = 1;

/** Celebrations waiting to be shown, oldest first. The host shows strictly one at a time. */
export const useCelebrations = create<CelebrationState>((set) => ({
  queue: [],
  holds: 0,
  hold: () => set((state) => ({ holds: state.holds + 1 })),
  release: () => set((state) => ({ holds: Math.max(0, state.holds - 1) })),
  topLevel: 0,
  push: (celebration) =>
    set((state) => {
      if (celebration.type === 'levelUp') {
        if (celebration.level <= state.topLevel) return state;
        return {
          topLevel: celebration.level,
          queue: [...state.queue, { ...celebration, id: nextId++ } as Celebration],
        };
      }
      return { queue: [...state.queue, { ...celebration, id: nextId++ } as Celebration] };
    }),
  dismiss: (id) => set((state) => ({ queue: state.queue.filter((item) => item.id !== id) })),
}));

export const isEmptyReward = (reward: Reward | null | undefined) =>
  !reward || (reward.xp === 0 && reward.influence === 0 && reward.bonusPacks === 0 && reward.unlocks.length === 0);
