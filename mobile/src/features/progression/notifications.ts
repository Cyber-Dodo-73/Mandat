import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import type { NotificationKind, PlannedNotification } from './notificationPlan';

export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export type NotificationTexts = Record<NotificationKind, { title: string; body: string }>;

const ANDROID_CHANNEL = 'reminders';
let configured = false;

/** Foreground behavior and the Android channel; safe to call more than once. */
export async function configureNotifications(channelName: string): Promise<void> {
  if (configured) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: channelName,
      importance: AndroidImportance.DEFAULT,
    });
  }
}

export async function getNotificationPermission(): Promise<NotificationPermission> {
  try {
    const status = await Notifications.getPermissionsAsync();
    if (status.granted) return 'granted';
    return status.canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'denied';
  }
}

/** Asked from an explicit player action (never on first launch). */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  try {
    const status = await Notifications.requestPermissionsAsync();
    return status.granted ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/**
 * Replaces every pending reminder by `plan`. Called on app start, when the app comes back
 * to the foreground and after server state changes (pack opened, mission claimed…).
 */
export async function applyNotificationPlan(plan: readonly PlannedNotification[], texts: NotificationTexts): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const item of plan) {
      await Notifications.scheduleNotificationAsync({
        content: { title: texts[item.kind].title, body: texts[item.kind].body, data: { kind: item.kind } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(item.at),
          channelId: ANDROID_CHANNEL,
        },
      });
    }
  } catch {
    // Reminders are a convenience: a scheduling failure must never break the app.
  }
}
