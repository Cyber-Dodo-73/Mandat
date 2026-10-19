/**
 * End-to-end run of the app's own API code against the real server.
 * Opt-in (hits the network and creates a throwaway account, deleted at the end):
 *   MANDAT_E2E=1 npm test -- production.e2e
 * Against a local stack: EXPO_PUBLIC_API_URL=http://localhost:8080 MANDAT_E2E=1 npm test -- --no-cache production.e2e
 * MANDAT_E2E_FOREIGN=0 runs it with plain Node fetch instead of the expo-fetch mimic.
 *
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-require-imports -- modules are loaded after the fetch shim is installed */
import { describe, expect, it, jest } from '@jest/globals';

const mockSecureMemory = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockSecureMemory.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockSecureMemory.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockSecureMemory.delete(key);
  },
}));
jest.mock('expo-localization', () => ({
  getCalendars: () => [{ timeZone: 'Europe/Paris' }],
  getLocales: () => [{ languageCode: 'fr', languageTag: 'fr-FR' }],
}));
jest.mock('@react-native-community/netinfo', () => ({ addEventListener: () => () => undefined }));

const RUN = process.env.MANDAT_E2E === '1';
const FOREIGN = process.env.MANDAT_E2E_FOREIGN !== '0';
const originalFetch = globalThis.fetch;
const { nodeFetch } = require('../testing/nodeTransport') as {
  nodeFetch: (url: string, init?: RequestInit) => Promise<Response>;
};


/** Mimics expo/fetch: a Response-like object that is NOT an instance of the global Response. */
class ForeignResponse {
  readonly status: number;
  readonly statusText: string;
  readonly ok: boolean;
  readonly headers: Headers;
  readonly url: string;
  private readonly bodyText: string;

  constructor(status: number, statusText: string, headers: Headers, url: string, bodyText: string) {
    this.status = status;
    this.statusText = statusText;
    this.ok = status >= 200 && status < 300;
    this.headers = headers;
    this.url = url;
    this.bodyText = bodyText;
  }

  async text() {
    return this.bodyText;
  }

  async json() {
    return JSON.parse(this.bodyText) as unknown;
  }

  clone() {
    return new ForeignResponse(this.status, this.statusText, this.headers, this.url, this.bodyText);
  }
}

const calls: string[] = [];
async function deviceLikeFetch(input: unknown, init?: RequestInit): Promise<Response> {
  // Like React Native, refuse Request objects: the app must pass a URL string.
  if (typeof input !== 'string') throw new TypeError('Network request failed');
  calls.push(`${init?.method ?? 'GET'} ${input.replace(/^https?:\/\/[^/]+/, '')}`);
  const response = await nodeFetch(input, init);
  if (process.env.MANDAT_E2E_DEBUG) console.log('DBG', init?.method, input, response.status, JSON.stringify(init?.headers), String(init?.body).slice(0, 120), [...response.headers].map(([k, v]) => k + '=' + v).join('; '));
  if (!FOREIGN) return response;
  const text = await response.text();
  return new ForeignResponse(response.status, response.statusText, response.headers, input, text) as unknown as Response;
}

(RUN ? describe : describe.skip)('production API through the app code', () => {
  it(
    'runs the full player flow',
    async () => {
      globalThis.fetch = deviceLikeFetch as typeof fetch;
      const { api, unwrap, tokenStore } = require('@/lib/api') as typeof import('@/lib/api');
      const auth = require('@/features/auth/api') as typeof import('@/features/auth/api');
      const packs = require('@/features/packs/api') as typeof import('@/features/packs/api');
      const { useSessionStore } = require('@/features/auth/session') as typeof import('@/features/auth/session');

      const suffix = Math.random().toString(16).slice(2, 10);
      const email = `audit-${suffix}@example.com`;
      const password = `Audit-${suffix}-pw`;
      const log = (label: string, value: unknown) => console.log(label, JSON.stringify(value).slice(0, 600));
      let registered = false;

      try {
        await auth.register({ email, password, nickname: `audit${suffix}` });
        registered = true;
        expect(useSessionStore.getState().status).toBe('signedIn');

        const me = await unwrap(api.GET('/api/v1/me'));
        log('me', me);
        const progression = await unwrap(api.GET('/api/v1/progression'));
        log('progression', progression);

        const view = await packs.fetchPacks();
        log('packs view', view);
        expect(view.packs.length).toBeGreaterThan(0);
        const odds = await packs.fetchPackOdds('s1-standard');
        log('odds', odds);

        const key = `audit-${suffix}`;
        const opened = await packs.openPack('s1-standard', key);
        log('open', opened);
        expect(opened.cards).toHaveLength(5);
        const replay = await packs.openPack('s1-standard', key);
        expect(replay.openingId).toBe(opened.openingId);

        const collection = await unwrap(api.GET('/api/v1/collection'));
        log('collection', collection);
        log('missions', await unwrap(api.GET('/api/v1/missions')));
        log('achievements', await unwrap(api.GET('/api/v1/achievements')));
        log('season pass', await unwrap(api.GET('/api/v1/season-pass')));
        log('settings', await unwrap(api.PATCH('/api/v1/me/settings', { body: { soundEnabled: false } })));

        // Expired / invalid access token: one refresh, then the call is replayed.
        const tokens = tokenStore.get();
        expect(tokens).not.toBeNull();
        await tokenStore.save({ accessToken: 'invalid.token.value', refreshToken: tokens!.refreshToken });
        calls.length = 0;
        const afterRefresh = await packs.fetchPacks();
        expect(afterRefresh.packs.length).toBeGreaterThan(0);
        expect(calls.filter((call) => call.endsWith('/auth/refresh'))).toHaveLength(1);
        expect(tokenStore.get()?.accessToken).not.toBe('invalid.token.value');

        // ProblemDetail errors keep their code.
        await expect(packs.openPack('s1-oceania', `locked-${suffix}`)).rejects.toMatchObject({ code: 'pack_locked' });

        await auth.logout();
        expect(useSessionStore.getState().status).toBe('signedOut');
        await expect(auth.login(email, 'wrong-password')).rejects.toMatchObject({ code: 'invalid_credentials' });
        await auth.login(email, password);
        expect(useSessionStore.getState().status).toBe('signedIn');
      } finally {
        if (registered) {
          if (!tokenStore.get()) await auth.login(email, password).catch(() => undefined);
          await auth.deleteAccount();
          expect(useSessionStore.getState().status).toBe('signedOut');
        }
        globalThis.fetch = originalFetch;
      }
    },
    60_000,
  );
});
