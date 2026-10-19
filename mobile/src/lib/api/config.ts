const DEFAULT_API_URL = 'https://mandat.cyber-dodo.fr';

/** Base URL of the MANDAT API, configured via EXPO_PUBLIC_API_URL. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/$/, '');
