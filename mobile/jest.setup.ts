import { setUpTests } from 'react-native-reanimated';

setUpTests();

// expo-sqlite needs the native SQLite module: use an in-memory store in Jest.
jest.mock('expo-sqlite/kv-store', () => {
  const values = new Map<string, string>();
  return {
    Storage: {
      getItemSync: (key: string) => values.get(key) ?? null,
      setItemSync: (key: string, value: string) => values.set(key, value),
      removeItemSync: (key: string) => values.delete(key),
    },
  };
});
