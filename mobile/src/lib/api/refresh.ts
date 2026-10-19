import { API_URL } from './config';
import { ApiError, NETWORK_ERROR, problemToError } from './errors';
import type { components } from './schema';
import { notifySessionExpired, tokenStore } from './tokens';

type AuthResponse = components['schemas']['AuthResponse'];

export const REFRESH_PATH = '/api/v1/auth/refresh';

let inflight: Promise<string | null> | null = null;

/**
 * Exchanges the refresh token for a new pair. Single flight: concurrent callers share
 * one request, because the server revokes the whole token family when a refresh token
 * is presented twice. Resolves to the new access token, or null when the session is
 * over (no token, or rejected by the server — listeners are notified). Transport
 * failures throw a network ApiError and keep the session.
 */
export function refreshAccessToken(): Promise<string | null> {
  inflight ??= runRefresh().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function runRefresh(): Promise<string | null> {
  const tokens = tokenStore.get();
  if (!tokens) return null;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${REFRESH_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
  } catch {
    throw new ApiError(0, NETWORK_ERROR);
  }

  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      await tokenStore.clear();
      notifySessionExpired();
      return null;
    }
    throw problemToError(response.status, await response.json().catch(() => null));
  }

  const body = (await response.json()) as AuthResponse;
  await tokenStore.save({ accessToken: body.accessToken, refreshToken: body.refreshToken });
  return body.accessToken;
}
