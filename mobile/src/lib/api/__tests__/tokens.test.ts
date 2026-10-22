import * as SecureStore from 'expo-secure-store';

import { tokenStore } from '../tokens';

jest.mock('expo-secure-store', () => {
  const values = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
    getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => void values.set(key, value)),
    deleteItemAsync: jest.fn(async (key: string) => void values.delete(key)),
  };
});

const setItem = SecureStore.setItemAsync as jest.Mock;

describe('tokenStore', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    await tokenStore.clear();
    setItem.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('writes the refresh token before the access token, readable after a restart', async () => {
    await tokenStore.save({ accessToken: 'a1', refreshToken: 'r1' });
    expect(setItem.mock.calls.map(([key]) => key)).toEqual(['mandat.refreshToken', 'mandat.accessToken']);
    expect(setItem.mock.calls[0][2]).toEqual({ keychainAccessible: 'AFTER_FIRST_UNLOCK' });
    await expect(tokenStore.load()).resolves.toEqual({ accessToken: 'a1', refreshToken: 'r1' });
  });

  it('keeps the pair in memory and retries when the secure store refuses the write', async () => {
    setItem.mockRejectedValueOnce(new Error('User interaction is not allowed'));
    await tokenStore.save({ accessToken: 'a2', refreshToken: 'r2' });

    // The session goes on with the new tokens even though nothing reached the disk.
    expect(tokenStore.get()).toEqual({ accessToken: 'a2', refreshToken: 'r2' });
    expect(setItem).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(2_000);
    expect(setItem).toHaveBeenCalledTimes(3);
    await expect(tokenStore.load()).resolves.toEqual({ accessToken: 'a2', refreshToken: 'r2' });
  });

  it('never persists a pair that was cleared while a retry was pending', async () => {
    setItem.mockRejectedValueOnce(new Error('locked'));
    await tokenStore.save({ accessToken: 'a3', refreshToken: 'r3' });
    await tokenStore.clear();
    await jest.advanceTimersByTimeAsync(5_000);
    expect(setItem).toHaveBeenCalledTimes(1);
    await expect(tokenStore.load()).resolves.toBeNull();
  });
});
