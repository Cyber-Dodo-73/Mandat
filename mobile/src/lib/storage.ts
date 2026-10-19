import { Storage } from 'expo-sqlite/kv-store';
import type { StateStorage } from 'zustand/middleware';

/**
 * Synchronous key-value storage backed by expo-sqlite (bundled in Expo Go).
 * Everything persisted on device goes through this module, so the backend can
 * be swapped without touching stores or the React Query persister.
 */
export type KeyValueStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export const storage: KeyValueStorage = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
};

/** Synchronous zustand adapter: stores hydrate before the first render. */
export const zustandStorage: StateStorage = storage;
