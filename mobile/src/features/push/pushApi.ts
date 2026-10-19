import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { api, unwrap, type components } from '@/lib/api';

import { needsRegistration, usePushStore } from './pushStore';

export type PushPreferences = components['schemas']['PushPreferencesDto'];
export type PushCategory = keyof PushPreferences;
export const PUSH_CATEGORIES: readonly PushCategory[] = ['boosterReady', 'streak', 'friends', 'events', 'marketing'];

export const pushPreferencesQueryKey = ['push', 'preferences'] as const;

/** Expo push token of this device, null on simulators or when the push service is unreachable. */
export async function getExpoPushToken(): Promise<string | null> {
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) return null;
  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch {
    return null;
  }
}

/** Sends the token to the server when new, changed or stale. Never throws. */
export async function registerPushToken(token: string, locale: string, now = Date.now()): Promise<boolean> {
  if (!needsRegistration(usePushStore.getState(), token, now)) return true;
  try {
    await unwrap(
      api.POST('/api/v1/push/devices', {
        body: { token, platform: Platform.OS === 'android' ? 'android' : 'ios', locale: locale === 'en' ? 'en' : 'fr' },
      }),
    );
    usePushStore.getState().setRegistered(token, now);
    return true;
  } catch {
    return false;
  }
}

/** Removes this device from the server (sign out, notifications turned off). Never throws. */
export async function unregisterPushToken(): Promise<void> {
  const token = usePushStore.getState().registeredToken;
  usePushStore.getState().clearRegistered();
  if (!token) return;
  await unwrap(api.DELETE('/api/v1/push/devices/{token}', { params: { path: { token } } })).catch(() => undefined);
}

export function usePushPreferencesQuery(enabled = true) {
  return useQuery<PushPreferences>({
    queryKey: pushPreferencesQueryKey,
    queryFn: () => unwrap(api.GET('/api/v1/push/preferences')),
    enabled,
  });
}

/** Optimistic per-category toggle, the server answer wins. */
export function useUpdatePushPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<PushPreferences>) => unwrap(api.PATCH('/api/v1/push/preferences', { body: patch })),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: pushPreferencesQueryKey });
      const previous = queryClient.getQueryData<PushPreferences>(pushPreferencesQueryKey);
      if (previous) queryClient.setQueryData<PushPreferences>(pushPreferencesQueryKey, { ...previous, ...patch });
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(pushPreferencesQueryKey, context.previous);
    },
    onSuccess: (data) => queryClient.setQueryData(pushPreferencesQueryKey, data),
  });
}
