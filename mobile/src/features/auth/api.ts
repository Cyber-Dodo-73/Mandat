import { getCalendars } from 'expo-localization';
import { Platform } from 'react-native';

import { useSettingsStore } from '@/features/settings/store';
import { api, tokenStore, unwrap } from '@/lib/api';

import { useSessionStore } from './session';

function deviceContext() {
  return {
    deviceLabel: Platform.OS === 'ios' ? 'iPhone' : 'Android',
    language: useSettingsStore.getState().language,
    timezone: getCalendars()[0]?.timeZone ?? null,
  };
}

export async function login(email: string, password: string): Promise<void> {
  const auth = await unwrap(
    api.POST('/api/v1/auth/login', { body: { email, password, deviceLabel: deviceContext().deviceLabel } }),
  );
  await useSessionStore.getState().signIn(auth);
}

export async function register(input: { email: string; password: string; nickname: string }): Promise<void> {
  const auth = await unwrap(api.POST('/api/v1/auth/register', { body: { ...input, ...deviceContext() } }));
  await useSessionStore.getState().signIn(auth);
}

export async function signInWithApple(idToken: string, nonce: string, nickname: string | null): Promise<void> {
  const auth = await unwrap(
    api.POST('/api/v1/auth/apple', { body: { idToken, nonce, nickname, ...deviceContext() } }),
  );
  await useSessionStore.getState().signIn(auth);
}

export async function signInWithGoogle(idToken: string): Promise<void> {
  const auth = await unwrap(api.POST('/api/v1/auth/google', { body: { idToken, ...deviceContext() } }));
  await useSessionStore.getState().signIn(auth);
}

/** Revokes the refresh token on the server (best effort), then forgets the session. */
export async function logout(): Promise<void> {
  const refreshToken = tokenStore.get()?.refreshToken;
  if (refreshToken) {
    await unwrap(api.POST('/api/v1/auth/logout', { body: { refreshToken } })).catch(() => undefined);
  }
  await useSessionStore.getState().clear();
}

/** Permanently deletes the account (App Store / GDPR requirement). */
export async function deleteAccount(): Promise<void> {
  await unwrap(api.DELETE('/api/v1/me'));
  await useSessionStore.getState().clear();
}
