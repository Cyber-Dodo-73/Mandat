import NetInfo from '@react-native-community/netinfo';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import type { PersistQueryClientProviderProps } from '@tanstack/react-query-persist-client';

import { storage } from '@/lib/storage';

import { ApiError } from './errors';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

// React Query pauses network calls while the phone is offline and resumes them after.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: MINUTE,
      // Kept long enough for the persisted cache to show collection and profile offline.
      gcTime: 7 * DAY,
      // Client errors (4xx) are answers, not glitches: only retry transport and server errors.
      retry: (failureCount, error) =>
        failureCount < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

const persister = createSyncStoragePersister({ storage, key: 'mandat.queryCache', throttleTime: 1000 });

/** Bump when cached query shapes change: the persisted cache is dropped on mismatch. */
const CACHE_BUSTER = 'v1';

export const persistOptions: PersistQueryClientProviderProps['persistOptions'] = {
  persister,
  maxAge: 7 * DAY,
  buster: CACHE_BUSTER,
};

/** Forgets everything cached for the signed-in player (sign out, account deletion). */
export function clearQueryCache(): void {
  queryClient.clear();
  persister.removeClient();
}
