const DEFAULT_API_URL = 'https://mandat.cyber-dodo.fr';

/** Base URL of the MANDAT API, configured via EXPO_PUBLIC_API_URL. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/$/, '');

/**
 * Upper bound for one HTTP call. React Native's fetch has no timeout of its own: on a flaky
 * connection a request could otherwise hang forever, leaving spinners and stale state behind.
 */
export const REQUEST_TIMEOUT_MS = 20_000;
