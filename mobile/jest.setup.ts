import { setUpTests } from 'react-native-reanimated';

setUpTests();

// MMKV needs the native Nitro module: use an in-memory store in Jest.
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    const values = new Map<string, string>();
    return {
      getString: (key: string) => values.get(key),
      set: (key: string, value: string) => values.set(key, value),
      remove: (key: string) => values.delete(key),
    };
  },
}));

// NetInfo needs its native module: use the mock shipped with the package.
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock.js'));

// Sentry needs its native module: keep the public surface used by the app as no-ops.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: (component: unknown) => component,
  wrapExpoRouterErrorBoundary: (component: unknown) => component,
  expoRouterIntegration: jest.fn(() => ({ name: 'ExpoRouter' })),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));
