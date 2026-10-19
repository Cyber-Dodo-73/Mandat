import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useNotificationPermission } from '@/features/progression/useNotificationSync';
import { useSettingsStore } from '@/features/settings/store';

import { getExpoPushToken, registerPushToken, unregisterPushToken } from './pushApi';
import { pathFromNotificationData } from './routing';

/**
 * Keeps this device registered for server pushes while the player allows notifications (OS
 * permission + in-app toggle): on start, back to the foreground and when Expo rotates the token.
 * Turning notifications off removes the device from the server.
 */
export function usePushSync() {
  const enabled = useSettingsStore((state) => state.notificationsEnabled);
  const language = useSettingsStore((state) => state.language);
  const { permission } = useNotificationPermission();

  useEffect(() => {
    if (permission === null) return undefined;
    if (!enabled || permission !== 'granted') {
      void unregisterPushToken();
      return undefined;
    }
    const sync = () => {
      void getExpoPushToken().then((token) => (token ? registerPushToken(token, language) : false));
    };
    sync();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') sync();
    });
    const tokenChange = Notifications.addPushTokenListener(() => sync());
    return () => {
      appState.remove();
      tokenChange.remove();
    };
  }, [enabled, language, permission]);
}

/** Opens the screen a tapped notification points to (also for the tap that launched the app). */
export function useNotificationTapRouting() {
  useEffect(() => {
    const open = (data: unknown) => {
      const path = pathFromNotificationData(data);
      if (path) router.push(path as never);
    };
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) {
          open(response.notification.request.content.data);
          void Notifications.clearLastNotificationResponseAsync();
        }
      })
      .catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener((response) =>
      open(response.notification.request.content.data),
    );
    return () => subscription.remove();
  }, []);
}
