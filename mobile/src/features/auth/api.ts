import { getCalendars } from 'expo-localization';
import { Platform } from 'react-native';

import { unregisterPushToken } from '@/features/push/pushApi';
import { usePushStore } from '@/features/push/pushStore';
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
  // The form only submits once the terms and age checkbox is ticked.
  const auth = await unwrap(
    api.POST('/api/v1/auth/register', {
      body: { ...input, acceptTerms: true, ageConfirmed: true, ...deviceContext() },
    }),
  );
  await useSessionStore.getState().signIn(auth);
}

/**
 * Signing in with a provider accepts the terms shown on the welcome screen. The Apple
 * authorization code lets the server revoke the Apple authorization if the account is deleted.
 */
export async function signInWithApple(
  idToken: string,
  nonce: string,
  nickname: string | null,
  authorizationCode: string | null,
): Promise<void> {
  const auth = await unwrap(
    api.POST('/api/v1/auth/apple', {
      body: { idToken, nonce, nickname, authorizationCode, acceptTerms: true, ...deviceContext() },
    }),
  );
  await useSessionStore.getState().signIn(auth);
}

export async function signInWithGoogle(idToken: string): Promise<void> {
  const auth = await unwrap(
    api.POST('/api/v1/auth/google', { body: { idToken, acceptTerms: true, ...deviceContext() } }),
  );
  await useSessionStore.getState().signIn(auth);
}

/** Emails a reset link; the answer is the same whether or not the address has an account. */
export async function requestPasswordReset(email: string): Promise<void> {
  await unwrap(api.POST('/api/v1/auth/password/forgot', { body: { email } }));
}

/** Revokes the refresh token on the server (best effort), then forgets the session. */
export async function logout(): Promise<void> {
  // Stop pushes to this device for the account that is signing out (needs the access token).
  await unregisterPushToken();
  const refreshToken = tokenStore.get()?.refreshToken;
  if (refreshToken) {
    await unwrap(api.POST('/api/v1/auth/logout', { body: { refreshToken } })).catch(() => undefined);
  }
  await useSessionStore.getState().clear();
}

/** Permanently deletes the account (App Store / GDPR requirement). */
export async function deleteAccount(): Promise<void> {
  await unwrap(api.DELETE('/api/v1/me'));
  // The server deleted the devices with the account.
  usePushStore.getState().clearRegistered();
  await useSessionStore.getState().clear();
}
