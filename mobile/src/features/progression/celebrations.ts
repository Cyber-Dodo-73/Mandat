import { create } from 'zustand';

import type { Reward } from './api';

export type Celebration =
  | { id: number; type: 'levelUp'; level: number; rewards: Reward | null }
  | { id: number; type: 'reward'; reward: Reward };

type CelebrationState = {
  queue: Celebration[];
  push: (celebration: DistributiveOmit<Celebration, 'id'>) => void;
  dismiss: (id: number) => void;
};

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

let nextId = 1;

/** Celebrations waiting to be shown, oldest first. Shown one at a time by the host. */
export const useCelebrations = create<CelebrationState>((set) => ({
  queue: [],
  push: (celebration) => set((state) => ({ queue: [...state.queue, { ...celebration, id: nextId++ } as Celebration] })),
  dismiss: (id) => set((state) => ({ queue: state.queue.filter((item) => item.id !== id) })),
}));

export const isEmptyReward = (reward: Reward | null | undefined) =>
  !reward || (reward.xp === 0 && reward.influence === 0 && reward.bonusPacks === 0 && reward.unlocks.length === 0);
