import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';
import type { Rarity } from '@/theme/rarity';

type RevealMemoryState = {
  /** Rarities whose full reveal the player has already watched once (UX only, no game value). */
  seen: Rarity[];
  markSeen: (rarity: Rarity) => void;
};

export const useRevealMemory = create<RevealMemoryState>()(
  persist(
    (set) => ({
      seen: [],
      markSeen: (rarity) => set((state) => (state.seen.includes(rarity) ? state : { seen: [...state.seen, rarity] })),
    }),
    { name: 'reveal-memory', version: 1, storage: createJSONStorage(() => zustandStorage) },
  ),
);
