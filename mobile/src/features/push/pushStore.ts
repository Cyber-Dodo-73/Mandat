import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';

/** Re-register the same token at least this often, so the server's last_seen stays fresh. */
export const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

type PushState = {
  /** Expo push token registered on the server for this device, null when none. */
  registeredToken: string | null;
  registeredAt: number | null;
  setRegistered: (token: string, at: number) => void;
  clearRegistered: () => void;
};

/**
 * Server push registration of this device. When a token is registered the server sends the
 * booster / streak reminders, so the local fallbacks are cancelled (no duplicates).
 */
export const usePushStore = create<PushState>()(
  persist(
    (set) => ({
      registeredToken: null,
      registeredAt: null,
      setRegistered: (token, at) => set({ registeredToken: token, registeredAt: at }),
      clearRegistered: () => set({ registeredToken: null, registeredAt: null }),
    }),
    { name: 'push-registration', storage: createJSONStorage(() => zustandStorage) },
  ),
);

/** True when the token must be (re)sent to the server. */
export function needsRegistration(
  state: Pick<PushState, 'registeredToken' | 'registeredAt'>,
  token: string,
  now: number,
): boolean {
  return state.registeredToken !== token || state.registeredAt === null || now - state.registeredAt > REFRESH_INTERVAL_MS;
}
