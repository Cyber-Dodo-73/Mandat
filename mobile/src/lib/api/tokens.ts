import * as SecureStore from 'expo-secure-store';

export type TokenPair = { accessToken: string; refreshToken: string };

const ACCESS_KEY = 'mandat.accessToken';
const REFRESH_KEY = 'mandat.refreshToken';

let current: TokenPair | null = null;
const expiryListeners = new Set<() => void>();

/**
 * Session tokens. Both live in the secure store; the pair is also kept in memory so
 * every request can read the access token synchronously.
 */
export const tokenStore = {
  get(): TokenPair | null {
    return current;
  },

  async load(): Promise<TokenPair | null> {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_KEY),
      SecureStore.getItemAsync(REFRESH_KEY),
    ]);
    current = accessToken && refreshToken ? { accessToken, refreshToken } : null;
    return current;
  },

  async save(pair: TokenPair): Promise<void> {
    current = pair;
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, pair.accessToken),
      SecureStore.setItemAsync(REFRESH_KEY, pair.refreshToken),
    ]);
  },

  async clear(): Promise<void> {
    current = null;
    await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
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
