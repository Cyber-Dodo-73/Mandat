import { create } from 'zustand';

import { clearQueryCache, onSessionExpired, tokenStore, type components } from '@/lib/api';
import { setMonitoringUser } from '@/lib/monitoring';

type AuthResponse = components['schemas']['AuthResponse'];

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

type SessionState = {
  status: SessionStatus;
  /** True right after an account was created (welcome flow, first pack). */
  isNewPlayer: boolean;
  bootstrap: () => Promise<void>;
  signIn: (auth: AuthResponse) => Promise<void>;
  /** Local sign out: forgets tokens and every cached query. */
  clear: () => Promise<void>;
};

export const useSessionStore = create<SessionState>()((set) => ({
  status: 'loading',
  isNewPlayer: false,
  bootstrap: async () => {
    const tokens = await tokenStore.load().catch(() => null);
    set({ status: tokens ? 'signedIn' : 'signedOut' });
  },
  signIn: async (auth) => {
    await tokenStore.save({ accessToken: auth.accessToken, refreshToken: auth.refreshToken });
    setMonitoringUser(auth.userId);
    set({ status: 'signedIn', isNewPlayer: auth.newUser });
  },
  clear: async () => {
    await tokenStore.clear();
    clearQueryCache();
    setMonitoringUser(null);
    set({ status: 'signedOut', isNewPlayer: false });
  },
}));

// The refresh token was rejected (expired, revoked, reused): back to the welcome screen.
onSessionExpired(() => {
  clearQueryCache();
  setMonitoringUser(null);
  useSessionStore.setState({ status: 'signedOut', isNewPlayer: false });
});
