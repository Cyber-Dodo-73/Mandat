import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

/**
 * Synchronous key-value storage backed by MMKV. Everything persisted on device
 * goes through this module (zustand stores, React Query persister).
 */
export type KeyValueStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

const mmkv = createMMKV({ id: 'mandat' });

export const storage: KeyValueStorage = {
  getItem: (key) => mmkv.getString(key) ?? null,
  setItem: (key, value) => mmkv.set(key, value),
  removeItem: (key) => {
    mmkv.remove(key);
  },
};

/** Synchronous zustand adapter: stores hydrate before the first render. */
export const zustandStorage: StateStorage = storage;
