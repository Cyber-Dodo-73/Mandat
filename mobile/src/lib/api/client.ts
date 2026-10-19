import i18n from 'i18next';
import createClient, { type Middleware } from 'openapi-fetch';

import { API_URL } from './config';
import { refreshAccessToken } from './refresh';
import type { paths } from './schema';
import { tokenStore } from './tokens';

const AUTH_PATHS = '/api/v1/auth/';

/**
 * React Native's fetch is unreliable with Request objects (what openapi-fetch hands over):
 * it can fail with "Network request failed" although the server is reachable. Always call it
 * with a plain URL and init, the body read as text.
 */
export async function plainFetch(request: Request): Promise<Response> {
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? await request.text() : undefined;
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return fetch(request.url, { method: request.method, headers, body: body || undefined });
}

/** Untouched copies of authenticated requests, replayed once after a token refresh. */
const replayable = new WeakMap<Request, Request>();

/**
 * Adds the language and the bearer token to every call, and on a 401 refreshes the
 * session once (single flight) and replays the request with the new token.
 */
export const authMiddleware: Middleware = {
  onRequest({ request, schemaPath }) {
    request.headers.set('Accept-Language', i18n.language || 'fr');
    if (schemaPath.startsWith(AUTH_PATHS)) return request;
    const accessToken = tokenStore.get()?.accessToken;
    if (accessToken) request.headers.set('Authorization', `Bearer ${accessToken}`);
    replayable.set(request, request.clone());
    return request;
  },

  async onResponse({ request, response, schemaPath }) {
    if (response.status !== 401 || schemaPath.startsWith(AUTH_PATHS)) return response;
    const original = replayable.get(request);
    if (!original) return response;
    const accessToken = await refreshAccessToken();
    if (!accessToken) return response;
    const retry = new Request(original);
    retry.headers.set('Authorization', `Bearer ${accessToken}`);
    return plainFetch(retry);
  },
};

/**
 * Typed client generated from the API OpenAPI spec. Never call fetch by hand:
 * add endpoints to the API, run `npm run api:gen`, then use this client.
 */
export const api = createClient<paths>({ baseUrl: API_URL, fetch: plainFetch });
api.use(authMiddleware);
