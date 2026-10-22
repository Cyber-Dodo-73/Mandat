import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';

export type TokenPair = { accessToken: string; refreshToken: string };

const ACCESS_KEY = 'mandat.accessToken';
const REFRESH_KEY = 'mandat.refreshToken';

/**
 * iOS keychain items are unreadable (and unwritable) while the phone is locked with the default
 * accessibility: a refresh finishing right as the screen locks would then never land on disk and
 * the next launch would replay a token the server already rotated. After the first unlock since
 * boot the keychain stays available.
 */
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

/** Retry delays when the secure store refuses a write (locked device, transient keystore error). */
const RETRY_DELAYS_MS = [2_000, 10_000, 30_000];

let current: TokenPair | null = null;
/** Pair held in memory but not yet confirmed on disk. */
let unsaved: TokenPair | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryAttempt = 0;
const expiryListeners = new Set<() => void>();

async function persist(pair: TokenPair): Promise<void> {
  // The refresh token first: it is the one that matters when the app restarts.
  await SecureStore.setItemAsync(REFRESH_KEY, pair.refreshToken, SECURE_OPTIONS);
  await SecureStore.setItemAsync(ACCESS_KEY, pair.accessToken, SECURE_OPTIONS);
}

async function readPair(): Promise<TokenPair | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY, SECURE_OPTIONS),
    SecureStore.getItemAsync(REFRESH_KEY, SECURE_OPTIONS),
  ]);
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

function scheduleRetry(): void {
  if (retryTimer !== null || unsaved === null) return;
  const delay = RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)];
  retryAttempt += 1;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void tokenStore.flush();
  }, delay);
}

// Back to the foreground (phone unlocked): a pair the store refused earlier gets another chance.
AppState.addEventListener('change', (state) => {
  if (state === 'active' && unsaved !== null) void tokenStore.flush();
});

/**
 * Session tokens. Both live in the secure store; the pair is also kept in memory so
 * every request can read the access token synchronously. A pair the store cannot write
 * right away stays in memory and is written again later: the session never depends on
 * one keychain call succeeding.
 */
export const tokenStore = {
  get(): TokenPair | null {
    return current;
  },

  async load(): Promise<TokenPair | null> {
    try {
      current = await readPair();
    } catch {
      // Keystore hiccup right after boot: one more try before deciding there is no session.
      await new Promise((resolve) => setTimeout(resolve, 500));
      current = await readPair();
    }
    return current;
  },

  async save(pair: TokenPair): Promise<void> {
    current = pair;
    unsaved = pair;
    await tokenStore.flush();
  },

  /** Writes the pending pair to the secure store; on failure, retries later. Never throws. */
  async flush(): Promise<void> {
    const pair = unsaved;
    if (pair === null) return;
    try {
      await persist(pair);
      if (unsaved === pair) {
        unsaved = null;
        retryAttempt = 0;
      }
    } catch {
      scheduleRetry();
    }
  },

  async clear(): Promise<void> {
    current = null;
    unsaved = null;
    retryAttempt = 0;
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY, SECURE_OPTIONS),
      SecureStore.deleteItemAsync(REFRESH_KEY, SECURE_OPTIONS),
    ]).catch(() => undefined);
  },
};

/** Called when the server rejects the refresh token: the player must sign in again. */
export function onSessionExpired(listener: () => void): () => void {
  expiryListeners.add(listener);
  return () => expiryListeners.delete(listener);
}

export function notifySessionExpired(): void {
  for (const listener of expiryListeners) listener();
}
